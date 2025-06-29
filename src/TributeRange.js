// src/TributeRange.js
import "./utils"; // 导入垫片脚本 (如果 TributeRange 直接使用其中的功能)
import CaretUtils from "./CaretUtils"; // 导入光标和选区工具类
import PositionUtils from "./PositionUtils"; // 导入定位工具类

/**
 * @class TributeRange
 * @classdesc 此类封装了与浏览器文本范围 (Range)、选区 (Selection) 以及相关的文本操作逻辑。
 *            它作为更底层的 CaretUtils 和 PositionUtils 的外观 (Facade)，
 *            为 Tribute 主类提供了一个统一的接口来处理光标定位、文本获取与替换、菜单定位等。
 */
class TributeRange {
  /**
   * TributeRange 构造函数。
   * @param {Tribute} tribute - Tribute 主实例的引用。TributeRange 需要访问主实例的
   *                            配置、当前状态以及其他模块（如菜单）。
   */
  constructor(tribute) {
    this.tribute = tribute; // 保存对主 Tribute 实例的引用
    // this.tribute.range = this; // 主 Tribute 实例已经在其构造函数中将 this.range 设置为本实例

    // 实例化依赖的工具类，并传入主 Tribute 实例的引用
    this.caretUtils = new CaretUtils(tribute);
    this.positionUtils = new PositionUtils(tribute);
  }

  /**
   * 获取当前操作上下文的 `document` 对象。
   * 如果 Tribute 绑定在 iframe 内的元素上，则返回 iframe 的 `document`；否则返回主文档的 `document`。
   * @returns {Document} 当前的 `document` 对象。
   */
  getDocument() {
    // 此逻辑在多个工具类中可能重复，可以考虑将其集中到更核心的工具或在实例化时传递 document。
    // 目前为了保持类的相对独立性，在此处实现。
    let iframe;
    // 尝试从当前活动的 Tribute 集合配置中获取 iframe
    if (this.tribute.current && this.tribute.current.collection) {
      iframe = this.tribute.current.collection.iframe;
    } else if (this.tribute.collection && this.tribute.collection.length > 0) {
      // 如果没有当前活动集合，则尝试使用第一个定义的集合的 iframe 作为后备
      iframe = this.tribute.collection[0].iframe;
    }

    if (!iframe) {
      return document; // 没有配置 iframe，返回主文档的 document
    }
    // 返回 iframe 内部的 document 对象
    return iframe.contentWindow.document;
  }

  /**
   * 将提及菜单定位到当前光标/插入点附近。
   * @param {boolean} scrollTo - 是否在定位菜单后尝试将其滚动到视图中。
   */
  positionMenuAtCaret(scrollTo) {
    const context = this.tribute.current; // 获取当前的 Tribute 操作上下文
    // 如果没有上下文或上下文没有关联的元素，则隐藏菜单并返回
    if (!context || !context.element) {
      this.tribute.menu.hideMenu(); // 通过 TributeMenu 实例来隐藏菜单
      return;
    }

    // 从当前活动的集合配置中确定触发器是否需要前导空格
    const currentCollection = context.collection;
    const requireLeadingSpaceForTrigger = currentCollection ? currentCollection.requireLeadingSpace : true;

    // 获取触发提及所需的信息 (如触发字符位置、已输入的文本等)
    const info = this.getTriggerInfo(
      false, // 菜单当前是否已激活 (这里假设是初次定位或需要重新定位)
      this.tribute.hasTrailingSpace, // 当前文本是否有尾随空格 (由 Tribute 主逻辑维护)
      requireLeadingSpaceForTrigger,  // 当前触发器是否需要前导空格
      this.tribute.allowSpaces,       // 是否允许提及内容中包含空格
      this.tribute.autocompleteMode   // 是否处于自动完成模式
    );

    // 如果成功获取到触发信息并且有有效的提及位置
    if (info !== undefined && info.mentionPosition !== undefined) {
      // 如果 Tribute 配置禁用了菜单定位，则仅确保菜单可见即可
      if (!this.tribute.positionMenu) {
        if (this.tribute.menu && this.tribute.menu.menu) { // 确保菜单DOM元素存在
             this.tribute.menu.menu.style.cssText = "display: block;"; // 简单地显示菜单
        }
        return;
      }

      let coordinates; // 用于存储计算出的光标/插入点坐标
      // 根据当前元素类型 (普通输入框/文本区域 vs contentEditable) 调用不同的方法获取坐标
      if (!this.isContentEditable(context.element)) {
        // 对于 input/textarea，使用 PositionUtils 的特定方法获取坐标
        // 注意：_getTextAreaOrInputUnderlinePosition 是 PositionUtils 的内部方法，
        //      理论上应通过公共接口调用，但此处为保持与原始逻辑的结构相似性而直接访问。
        coordinates = this.positionUtils._getTextAreaOrInputUnderlinePosition(
          context.element,
          info.mentionPosition // 提及开始的位置 (触发字符的索引)
        );
      } else {
        // 对于 contentEditable 元素，使用 PositionUtils 的相应方法
        // mentionPosition 此时应为光标在锚点节点内的偏移量
        coordinates = this.positionUtils._getContentEditableCaretPosition(
          info.mentionSelectedOffset // 使用从 getTriggerInfo 获取的光标在锚点节点内的偏移量
        );
      }

      // 如果菜单DOM元素存在，则调用 PositionUtils 的方法将菜单定位到计算出的坐标
      if (this.tribute.menu && this.tribute.menu.menu) {
        this.positionUtils.positionMenuAtCaretCoordinates(coordinates, this.tribute.menu.menu, scrollTo);
      }

    } else {
      // 如果未能获取有效的触发信息，则隐藏菜单
      this.tribute.menu.hideMenu();
    }
  }

  /**
   * 获取关于当前可能的提及触发的详细信息。
   * 例如，它会确定触发字符、触发位置、用户已输入的提及文本等。
   * @param {boolean} menuAlreadyActive - 指示菜单当前是否已经处于激活状态。
   * @param {boolean} hasTrailingSpace - 指示光标前的文本是否以一个需要特殊处理的尾随空格结束。
   * @param {boolean} requireLeadingSpace - 指示当前检查的触发规则是否要求触发字符前有前导空格。
   * @param {boolean} allowSpaces - 指示当前触发规则是否允许提及的文本中包含空格。
   * @param {boolean} isAutocomplete - 指示当前是否处于自动完成模式 (无特定触发字符)。
   * @returns {object | undefined} - 如果找到有效的触发信息，则返回一个包含详细信息的对象，
   *                                 否则返回 `undefined`。返回的对象可能包含：
   *                                 `mentionPosition`: 触发字符在文本中的起始位置。
   *                                 `mentionText`: 用户在触发字符后已输入的文本。
   *                                 `mentionSelectedElement`: 触发提及的 DOM 元素。
   *                                 `mentionSelectedPath`: (仅 contentEditable) 从 `mentionSelectedElement` 到光标所在节点的路径。
   *                                 `mentionSelectedOffset`: (仅 contentEditable) 光标在 `anchorNode` 内的偏移量。
   *                                 `mentionTriggerChar`: 实际触发的字符。
   *                                 `anchorNode`: (仅 contentEditable) 光标实际所在的文本节点或元素。
   */
  getTriggerInfo(menuAlreadyActive, hasTrailingSpace, requireLeadingSpace, allowSpaces, isAutocomplete) {
    const ctx = this.tribute.current; // 获取当前 Tribute 操作上下文
    if (!ctx || !ctx.element) return undefined; // 上下文或元素无效，无法获取信息

    let selectedNode, path, offsetInNode, anchorNode;

    // 判断元素类型，并获取相应的选区/光标信息
    if (!this.isContentEditable(ctx.element)) {
      // 对于 <input> 或 <textarea>
      selectedNode = ctx.element; // 元素本身即为选区上下文
      // 对于这些元素，路径和节点内偏移量的概念与 contentEditable 不同，
      // 主要依赖 `selectionStart` (光标位置)。
      offsetInNode = ctx.element.selectionStart;
    } else {
      // 对于 contentEditable 元素
      const selectionInfo = this.caretUtils.getContentEditableSelectedPath(); // 使用 CaretUtils 获取选区路径信息
      if (selectionInfo) {
        selectedNode = selectionInfo.selected;     // contentEditable 容器元素
        path = selectionInfo.path;                 // 从容器到光标节点的路径
        offsetInNode = selectionInfo.offset;       // 光标在 anchorNode 内的偏移量
        anchorNode = selectionInfo.anchorNode;     // 光标实际所在的节点
      } else {
        return undefined; // 未获取到有效的选区信息
      }
    }

    // 获取光标位置之前的所有文本内容
    const effectiveRange = this.caretUtils.getTextPrecedingCurrentSelection();

    // 如果是自动完成模式 (isAutocomplete is true)
    if (isAutocomplete) {
        const lastWord = this.caretUtils.getLastWordInText(effectiveRange); // 获取文本中的最后一个 "单词"
        return {
            mentionPosition: effectiveRange.length - lastWord.length, // "提及" (即最后一个单词) 的起始位置
            mentionText: lastWord, // "提及" 的文本内容
            mentionSelectedElement: selectedNode,
            mentionSelectedPath: path,
            mentionSelectedOffset: offsetInNode,
            anchorNode: anchorNode
        };
    }

    // 如果不是自动完成模式 (即基于特定触发字符的模式)
    if (effectiveRange !== undefined && effectiveRange !== null) {
      let mostRecentTriggerCharPos = -1; // 初始化最近的触发字符位置
      let triggerCharDetails = null;     // 用于存储找到的最佳触发字符及其配置

      // 遍历 Tribute 配置中的所有集合 (每个集合可能对应一个触发规则)
      this.tribute.collection.forEach((config) => {
        const c = config.trigger; // 当前集合的触发字符
        // 确定当前规则是否需要前导空格 (优先使用集合内的配置，否则使用传入的全局配置)
        const currentRequireLeadingSpace = config.requireLeadingSpace !== undefined ? config.requireLeadingSpace : requireLeadingSpace;

        // 查找触发字符 c 在 `effectiveRange` 中最后出现的位置
        // 如果需要前导空格，则使用 `lastIndexWithLeadingSpace` 方法，否则使用 `lastIndexOf`
        const idx = currentRequireLeadingSpace
          ? this.lastIndexWithLeadingSpace(effectiveRange, c)
          : effectiveRange.lastIndexOf(c);

        // 如果找到了一个更靠后的触发字符，则更新记录
        if (idx > mostRecentTriggerCharPos) {
          mostRecentTriggerCharPos = idx;
          triggerCharDetails = { char: c, reqSpace: currentRequireLeadingSpace };
        }
      });

      // 如果找到了有效的触发字符 (triggerCharDetails 不为 null 且位置有效)
      if (triggerCharDetails && mostRecentTriggerCharPos >= 0) {
          const { char: triggerChar, reqSpace: currentReqSpace } = triggerCharDetails;

        // 再次校验前导空格条件 (虽然 lastIndexWithLeadingSpace 已处理，但多一层保险或不同逻辑路径)
        // 如果要求前导空格，但触发字符不在文本开头且其前一个字符不是空格，则视为无效触发
        if ( currentReqSpace && mostRecentTriggerCharPos > 0 && !/\s/.test(effectiveRange.substring(mostRecentTriggerCharPos - 1, mostRecentTriggerCharPos))) {
            return undefined; // 前导空格条件不满足
        }

        // 提取触发字符之后到光标位置的文本，作为用户已输入的提及内容 (snippet)
        let currentTriggerSnippet = effectiveRange.substring(
          mostRecentTriggerCharPos + triggerChar.length
        );

        // 如果不允许空格 (allowSpaces is false)，但 snippet 中包含空格
        if (!allowSpaces && /\s/.test(currentTriggerSnippet)) {
            // 原始代码中这部分逻辑比较复杂，涉及到 menuAlreadyActive 和 hasTrailingSpace。
            // 简化后的逻辑：如果菜单尚未激活，且 snippet 中有空格（且不允许空格），则视为无效触发。
            // 如果菜单已激活，则可能是在进行多词搜索，此时空格可能是合法的。
            if (/\s/.test(currentTriggerSnippet) && !menuAlreadyActive) {
                return undefined; // 无效触发
            }
        }

        // 处理尾随空格：如果 snippet 以空格结尾，并且通常不允许空格 (allowSpaces is false)，
        // 则设置 hasTrailingSpace 标记，并从 snippet 中移除尾随空格。
        // 这个标记可能用于后续逻辑，例如在选择提及项后是否自动添加空格。
        const endsWithSpace = /\s$/.test(currentTriggerSnippet);
        if (endsWithSpace && !allowSpaces) { // 注意：这里条件与原代码略有不同，原代码是 `!this.tribute.allowSpaces && this.tribute.hasTrailingSpace`
            this.tribute.hasTrailingSpace = true; // 更新主实例的状态
            currentTriggerSnippet = currentTriggerSnippet.trimEnd(); // 移除尾部空格
        } else {
            this.tribute.hasTrailingSpace = false;
        }

        // 返回包含所有提取信息的对象
        return {
          mentionPosition: mostRecentTriggerCharPos,
          mentionText: currentTriggerSnippet,
          mentionSelectedElement: selectedNode,
          mentionSelectedPath: path,
          mentionSelectedOffset: offsetInNode,
          mentionTriggerChar: triggerChar,
          anchorNode: anchorNode
        };
      }
    }
    return undefined; // 未找到任何有效触发
  }

  /**
   * 替换编辑器中的触发文本（例如，将 "@mention" 替换为选中的提及项）。
   * @param {string} text - 要插入的替换文本（通常是格式化后的提及项）。
   * @param {boolean} requireLeadingSpace - （未使用在此函数的当前实现中，但保留以匹配原始签名，可能用于更复杂的替换逻辑）
   * @param {boolean} hasTrailingSpaceSuffix - 是否应在插入的文本后自动添加一个后缀（通常是空格或 &nbsp;）。
   * @param {Event} originalEvent - 触发此次替换的原始 DOM 事件 (例如，键盘事件或鼠标点击事件)。
   * @param {object} item - 从提及菜单中选中的原始数据项。
   */
  replaceTriggerText(text, requireLeadingSpace, hasTrailingSpaceSuffix, originalEvent, item) {
    // 获取当前活动的集合配置，以确定实际的 `requireLeadingSpace` 规则
    const currentCollection = this.tribute.current.collection;
    const actualRequireLeadingSpace = currentCollection ? currentCollection.requireLeadingSpace : true;

    // 重新获取触发信息，此时假设菜单已激活 (menuAlreadyActive = true)
    // 因为这是在选择一个项目后发生的。
    // `hasTrailingSpace` 参数设为 false，因为尾随空格的处理由下面的 `textSuffix` 逻辑完成。
    const info = this.getTriggerInfo(
      true,  // menuAlreadyActive
      false, // hasTrailingSpace for suffix logic
      actualRequireLeadingSpace,
      this.tribute.allowSpaces,
      this.tribute.autocompleteMode
    );

    if (info !== undefined) { // 确保获取到有效的触发信息
      const context = this.tribute.current; // 当前操作上下文
      // 创建并分发 "tribute-replaced" 自定义事件，通知外部代码文本已被替换
      const replaceEvent = new CustomEvent("tribute-replaced", {
        detail: {
          item: item,             // 选中的原始数据项
          instance: context,      // 替换发生时的 Tribute 状态
          context: info,          // 触发替换时的上下文信息
          event: originalEvent,   // 原始 DOM 事件
        },
      });

      // 根据配置和元素类型确定替换文本后的后缀 (通常是空格)
      const textSuffix = typeof this.tribute.replaceTextSuffix === "string"
        ? this.tribute.replaceTextSuffix // 使用配置中指定的后缀
        : (this.isContentEditable(context.element) ? "\u00A0" : " "); // contentEditable用&nbsp;，其他用普通空格

      // 组合最终要插入的文本
      const textToInsert = text + (hasTrailingSpaceSuffix ? textSuffix : "");

      // 获取触发文本的起始位置
      const startPos = info.mentionPosition;
      // 计算触发文本的结束位置：起始位置 + 触发字符长度 + 已输入提及文本长度
      let endPos = info.mentionPosition +
                   (info.mentionTriggerChar ? info.mentionTriggerChar.length : 0) +
                   info.mentionText.length;

      // 根据元素类型执行文本替换
      if (!this.isContentEditable(context.element)) {
        // 对于 <input> 或 <textarea>
        const myField = context.element;
        const val = myField.value;
        // 通过拼接字符串替换文本
        myField.value = val.substring(0, startPos) + textToInsert + val.substring(endPos);

        // 更新光标位置到插入文本之后
        const newCaretPos = startPos + textToInsert.length;
        myField.selectionStart = newCaretPos;
        myField.selectionEnd = newCaretPos;

      } else {
        // 对于 contentEditable 元素
        if (!info.anchorNode) { // 必须有 anchorNode (光标所在节点) 才能操作
            // console.error("TributeRange.replaceTriggerText: contentEditable 元素的 anchorNode 未定义。");
            return;
        }

        // 计算在 anchorNode 内的替换范围的起始和结束偏移量
        // mentionSelectedOffset 是光标在 anchorNode 内的原始偏移量
        const replacementStartOffsetInAnchor = info.mentionSelectedOffset - info.mentionText.length - (info.mentionTriggerChar ? info.mentionTriggerChar.length : 0);
        const replacementEndOffsetInAnchor = info.mentionSelectedOffset;

        // 使用 CaretUtils 的 pasteHtml 方法执行替换
        this.caretUtils.pasteHtml(
          textToInsert,
          replacementStartOffsetInAnchor,
          replacementEndOffsetInAnchor
        );
      }

      // 触发 input 事件，以便其他可能监听此事件的逻辑 (如表单验证、数据绑定库) 能够响应更改
      context.element.dispatchEvent(new CustomEvent("input", { bubbles: true }));
      // 分发 "tribute-replaced" 事件
      context.element.dispatchEvent(replaceEvent);
    }
  }

  // --- 以下是将 CaretUtils 和 PositionUtils 中的方法委托给本类实例的便捷方法 ---
  // 这样，Tribute 主类可以直接通过 `this.range.methodName()` 调用，
  // 而不必关心这些方法具体是在 CaretUtils 还是 PositionUtils 中实现的。

  // 从 CaretUtils 委托的方法
  selectElement(targetElement, path, offset) {
    this.caretUtils.selectElement(targetElement, path, offset);
  }

  pasteHtml(html, startPos, endPos) {
    this.caretUtils.pasteHtml(html, startPos, endPos);
  }

  getWindowSelection() {
    // 注意：_getWindowSelection 是 CaretUtils 的内部方法，此处为保持结构而访问。
    // 理想情况下，CaretUtils 应提供公共接口。
    return this.caretUtils._getWindowSelection();
  }

  getNodePositionInParent(element) {
    return this.caretUtils.getNodePositionInParent(element);
  }

  getContentEditableSelectedPath() {
    return this.caretUtils.getContentEditableSelectedPath();
  }

  getTextPrecedingCurrentSelection() {
    return this.caretUtils.getTextPrecedingCurrentSelection();
  }

  getLastWordInText(text) {
    return this.caretUtils.getLastWordInText(text);
  }

  isContentEditable(element) {
    return this.caretUtils.isContentEditable(element);
  }

  placeCaretAtEnd(el) {
    this.caretUtils.placeCaretAtEnd(el);
  }

  insertTextAtCursor(text) {
    this.caretUtils.insertTextAtCursor(text);
  }

  insertAtCaret(textarea, text) {
    this.caretUtils.insertAtCaret(textarea, text);
  }

  // 从 PositionUtils 委托的方法 (如果有其他需要从此处直接调用的)
  // 目前，PositionUtils 的主要方法 (如 _getTextAreaOrInputUnderlinePosition, _getContentEditableCaretPosition, positionMenuAtCaretCoordinates)
  // 是在本类的 positionMenuAtCaret 方法内部被调用的，所以不需要在这里单独列出委托。

  /**
   * 查找字符串中最后一个满足特定条件的触发器实例。
   * 条件是：触发器或者在字符串的开头，或者其前一个字符是空白字符。
   * @param {string} str - 要在其中搜索的源字符串。
   * @param {string} trigger - 要查找的触发器字符串。
   * @returns {number} - 触发器在源字符串中最后一次有效出现的起始索引。如果未找到，则返回 -1。
   */
  lastIndexWithLeadingSpace(str, trigger) {
    if (!str || !trigger) return -1; // 输入无效，返回 -1

    let index = -1; // 初始化找到的索引为 -1
    // 从后向前遍历字符串，查找 trigger 的所有可能起始位置
    for (let i = str.length - trigger.length; i >= 0; i--) {
        // 检查从当前位置 i 开始的子串是否与 trigger 匹配
        if (str.substring(i, i + trigger.length) === trigger) {
            // 如果匹配，则检查是否满足前导条件
            if (i === 0 || /\s/.test(str[i - 1])) { // 在开头，或前一个是空格
                index = i; // 找到了有效匹配，记录索引
                break;     // 因为是从后向前找，第一个找到的就是最后一个有效匹配，所以可以跳出循环
            }
        }
    }
    return index; // 返回找到的索引，或初始值 -1
  }
}

export default TributeRange;
