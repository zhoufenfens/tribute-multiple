// src/CaretUtils.js

/**
 * @class CaretUtils
 * @classdesc 提供与光标（Caret）、选区（Selection）操作相关的底层工具函数。
 *            这些方法主要被 TributeRange 类用于实现更高级的文本操作和定位逻辑。
 *            此类封装了与浏览器相关的 DOM Selection 和 Range API 的复杂性。
 */
class CaretUtils {
  /**
   * CaretUtils 构造函数。
   * @param {Tribute} tribute - Tribute 主实例的引用。主要用于访问配置（如 iframe）以确定正确的 document 和 window 上下文。
   */
  constructor(tribute) {
    this.tribute = tribute; // 保存对 Tribute 主实例的引用
  }

  /**
   * 获取当前操作环境的 `document` 对象。
   * 如果 Tribute 实例配置了 `iframe`，则返回 iframe 内的 `document`；否则返回主窗口的 `document`。
   * @returns {Document} 当前的 `document` 对象。
   * @private
   */
  _getDocument() {
    let iframe;
    // 检查当前活动的 Tribute 集合配置中是否有 iframe
    if (this.tribute.current && this.tribute.current.collection) {
      iframe = this.tribute.current.collection.iframe;
    } else if (this.tribute.collection && this.tribute.collection.length > 0) {
      // 如果当前没有活动集合，则尝试使用第一个集合的 iframe 配置作为后备
      iframe = this.tribute.collection[0].iframe;
    }

    if (!iframe) {
      return document; // 没有 iframe，使用主文档
    }
    // 返回 iframe 内部的 document 对象
    return iframe.contentWindow.document;
  }

  /**
   * 获取当前操作环境的 `window.Selection` 对象。
   * 处理了可能在 iframe 内操作的情况。
   * @returns {Selection | null} 当前的 `Selection` 对象，如果无法获取则为 `null`。
   * @private
   */
  _getWindowSelection() {
    let iframe;
    // 类似于 _getDocument，确定正确的 iframe 上下文
    if (this.tribute.current && this.tribute.current.collection) {
      iframe = this.tribute.current.collection.iframe;
    } else if (this.tribute.collection && this.tribute.collection.length > 0) {
      iframe = this.tribute.collection[0].iframe;
    }

    if (iframe && iframe.contentWindow) {
      // 如果在 iframe 内，获取 iframe 的 selection 对象
      return iframe.contentWindow.getSelection();
    }
    // 否则，获取主窗口的 selection 对象
    return window.getSelection();
  }

  /**
   * 选中目标 DOM 元素内由路径和偏移量指定的位置。
   * 主要用于 contentEditable 元素，根据路径和偏移量恢复或设置光标位置。
   * @param {HTMLElement} targetElement - 操作的目标 DOM 元素 (通常是 contentEditable 容器)。
   * @param {Array<number>} path - 一个数字数组，表示从 `targetElement` 到目标文本节点或元素节点的子节点索引路径。
   * @param {number} offset - 在最终路径指向的节点内的字符偏移量（对于文本节点）或子节点索引（对于元素节点）。
   */
  selectElement(targetElement, path, offset) {
    let range;
    let elem = targetElement; // 从目标元素开始，根据路径向下查找
    const doc = this._getDocument(); // 获取正确的 document 上下文

    // 根据路径数组遍历子节点，找到最终的目标节点 `elem`
    if (path) {
      for (let i = 0; i < path.length; i++) {
        if (!elem || !elem.childNodes || elem.childNodes.length <= path[i]) {
          // 路径无效或DOM结构与路径不符，打印警告并返回
          // console.warn("CaretUtils.selectElement: 无效的路径或元素结构。", elem, path, i);
          return;
        }
        elem = elem.childNodes[path[i]]; // 移动到下一个子节点

        // 注意：原始代码中此处有一个 `while (elem.length < offset)` 循环，
        // 该循环逻辑似乎是为处理跨多个文本节点或兄弟节点计算偏移量而设计，
        // 但在当前上下文中可能导致问题或不精确。
        // 现代 Range API 通常直接在找到的 `elem` (文本节点或元素) 上设置偏移量。
        // 保持此方法专注于在 `elem` 内部设置偏移。
      }
    }

    // 确保最终的 `elem` 是一个有效的节点类型 (文本节点或元素节点)，以便在其上设置 Range
    if (!elem || (elem.nodeType !== Node.TEXT_NODE && elem.nodeType !== Node.ELEMENT_NODE)) {
      // console.warn("CaretUtils.selectElement: 路径的最终元素不是有效的 Range 目标节点。", elem);
      // 可以尝试寻找一个有效的子文本节点，但这需要更复杂的逻辑。
      // 目前，如果不是有效节点，则不继续操作。
      return;
    }

    const sel = this._getWindowSelection(); // 获取 Selection 对象
    if (!sel) return; // 如果无法获取 Selection，则无法操作

    try {
      range = doc.createRange(); // 创建一个新的 Range 对象
      // 确保偏移量 `offset` 在 `elem` 的有效范围内
      const maxOffset = (elem.nodeType === Node.TEXT_NODE) ? elem.nodeValue.length : elem.childNodes.length;
      if (offset > maxOffset) {
        // console.warn(`CaretUtils.selectElement: 偏移量 ${offset} 超出节点 ${elem.nodeName} 的有效范围 (最大 ${maxOffset})。将自动修正。`);
        offset = maxOffset; // 修正偏移量
      }

      // 设置 Range 的起始和结束位置 (对于光标，起始和结束位置相同)
      range.setStart(elem, offset);
      range.setEnd(elem, offset);
      range.collapse(true); // 折叠 Range 到其起始点，形成光标

      sel.removeAllRanges(); // 清除现有选区
      sel.addRange(range);   // 应用新的选区 (光标)
    } catch (error) {
      // console.error("CaretUtils.selectElement: 创建或设置 Range 时出错:", error, elem, offset);
    }

    // 聚焦目标元素，这可能会导致页面滚动。根据需要决定是否总是执行。
    // if (typeof targetElement.focus === 'function') {
    //   targetElement.focus();
    // }
  }

  /**
   * 在当前光标位置（或选区）粘贴 HTML 内容。主要用于 contentEditable 元素。
   * @param {string} html - 要粘贴的 HTML 字符串。
   * @param {number} startPos - 选区开始点在锚点节点 (anchorNode) 内的偏移量。用于定义要替换的范围的起点。
   * @param {number} endPos - 选区结束点在锚点节点内的偏移量。用于定义要替换的范围的终点。
   */
  pasteHtml(html, startPos, endPos) {
    const sel = this._getWindowSelection(); // 获取 Selection 对象
    // 如果没有选区或选区中没有 Range，则无法操作
    if (!sel || sel.rangeCount === 0) return;

    const doc = this._getDocument(); // 获取正确的 document
    // 克隆当前选区的第一个 Range，以避免直接修改原始选区状态，直到准备好应用更改
    const range = sel.getRangeAt(0).cloneRange();

    // 确保 startPos 和 endPos 在锚点节点 (range.startContainer) 的有效内容范围内
    const anchorNode = range.startContainer; // 通常是选区开始的节点
    const maxOffsetAnchor = (anchorNode.nodeType === Node.TEXT_NODE) ? anchorNode.nodeValue.length : anchorNode.childNodes.length;

    // 修正 startPos 和 endPos，确保它们在有效范围内
    const safeStartPos = Math.min(startPos, maxOffsetAnchor);
    const safeEndPos = Math.min(endPos, maxOffsetAnchor);

    // 如果修正后的 startPos 大于 endPos (逻辑错误)，则将 Range 折叠到 startPos
    if (safeStartPos > safeEndPos) {
        // console.warn(`CaretUtils.pasteHtml: 起始位置 ${safeStartPos} 大于结束位置 ${safeEndPos}。`);
        range.setStart(anchorNode, safeStartPos);
        range.setEnd(anchorNode, safeStartPos); // 折叠 Range
    } else {
        // 设置 Range 的起始和结束，以定义将要被删除和替换的内容
        range.setStart(anchorNode, safeStartPos);
        range.setEnd(anchorNode, safeEndPos);
    }

    try {
        range.deleteContents(); // 删除 Range 所覆盖的内容
    } catch (e) {
        // console.error("CaretUtils.pasteHtml: 删除内容时出错:", e, anchorNode, safeStartPos, safeEndPos);
        // 如果删除失败 (例如 Range 无效)，则退出以避免进一步错误
        return;
    }

    // 创建一个临时的 div 元素，用于将 HTML 字符串转换为 DOM 节点
    const tempDiv = doc.createElement("div");
    tempDiv.innerHTML = html; // 将 HTML 字符串设置到 div 的 innerHTML

    // 创建一个 DocumentFragment，用于高效地批量插入节点
    let frag = doc.createDocumentFragment();
    let node, lastNode; // lastNode 用于后续恢复光标位置

    // 将临时 div 中的所有子节点移动到 DocumentFragment
    while ((node = tempDiv.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag); // 在原始 Range 的位置插入 DocumentFragment (包含 HTML 内容)

    // 恢复光cursor/selection到插入内容之后
    if (lastNode) {
      const newRange = range.cloneRange(); // 基于修改后的 Range 创建新 Range
      newRange.setStartAfter(lastNode);    // 将新 Range 的起始点设置在最后一个插入的节点之后
      newRange.collapse(true);             // 折叠新 Range，形成光标
      sel.removeAllRanges();               // 清除旧选区
      sel.addRange(newRange);              // 应用新选区 (光标)
    }
  }

  /**
   * 获取指定 DOM 节点在其父节点内的位置索引。
   * @param {Node} element - 要检查的 DOM 节点。
   * @returns {number} - 节点在其父节点的 `childNodes` 列表中的索引。如果节点没有父节点，返回 0。
   */
  getNodePositionInParent(element) {
    if (!element.parentNode) {
      return 0; // 没有父节点，无法确定位置
    }
    // 遍历父节点的子节点列表，找到当前元素并返回其索引
    for (let i = 0; i < element.parentNode.childNodes.length; i++) {
      const node = element.parentNode.childNodes[i];
      if (node === element) {
        return i;
      }
    }
    return 0; // 理论上不应到达此处，除非元素不在其父节点的 childNodes 中 (DOM 异常)
  }

  /**
   * 获取 contentEditable 元素中当前光标（或选区起点）的详细路径信息。
   * 这包括光标所在的实际文本节点 (`anchorNode`)，从 contentEditable 容器到该节点的路径 (`path`)，
   * 以及光标在该节点内的偏移量 (`offset`)。
   * @returns {object | undefined} - 一个包含选区信息的对象：
   *                                 `selected`: 最近的 contentEditable 祖先元素。
   *                                 `path`: 到达 `anchorNode` 的子节点索引路径。
   *                                 `offset`: 光标在 `anchorNode` 内的偏移量。
   *                                 `anchorNode`: 光标实际所在的文本节点或元素节点。
   *                                 如果无法获取选区信息，则返回 `undefined`。
   */
  getContentEditableSelectedPath() {
    const sel = this._getWindowSelection(); // 获取当前 Selection 对象
    // 如果没有 Selection 或者没有锚点节点 (光标所在节点)，则无法确定路径
    if (!sel || sel.anchorNode === null) return undefined;

    let selectedContainer = sel.anchorNode; // 从光标所在的节点开始向上查找
    const path = []; // 用于存储路径的数组
    let offset;      // 光标在 anchorNode 内的偏移量

    let contentEditableAttr = selectedContainer.contentEditable;
    // 向上遍历 DOM 树，直到找到标记为 contentEditable="true" 的祖先元素，
    // 或者到达 BODY 元素或没有父元素的顶层。
    // 同时记录从 anchorNode 到这个 contentEditable 容器的路径。
    while (selectedContainer !== null && contentEditableAttr !== "true" && selectedContainer.nodeName !== 'BODY' && selectedContainer.parentNode) {
      const i = this.getNodePositionInParent(selectedContainer); // 获取当前节点在其父节点中的索引
      path.push(i); // 将索引添加到路径中
      selectedContainer = selectedContainer.parentNode; // 移动到父节点
      if (selectedContainer !== null) {
        contentEditableAttr = selectedContainer.contentEditable; // 更新 contentEditable 状态
      }
    }
    path.reverse(); // 路径是从下往上记录的，所以需要反转

    // 获取光标在 anchorNode (sel.anchorNode) 内的偏移量
    try {
      if (sel.rangeCount > 0) {
        offset = sel.getRangeAt(0).startOffset;
      } else {
        return undefined; // 没有可用的 Range
      }
    } catch (e) {
      // console.warn("CaretUtils.getContentEditableSelectedPath: 获取 Range 时出错:", e);
      return undefined;
    }

    return {
      selected: selectedContainer, // contentEditable 容器元素
      path: path,                  // 从容器到 anchorNode 的路径
      offset: offset,              // 光标在 anchorNode 内的偏移量
      anchorNode: sel.anchorNode   // 光标实际所在的节点
    };
  }

  /**
   * 获取当前光标位置之前的所有文本内容。
   * 对于普通输入框/文本区域，它返回 `value` 中从开头到光标位置的子串。
   * 对于 contentEditable 元素，它尝试获取光标所在文本节点内光标前的文本，并可能包括前面兄弟节点的文本。
   * @returns {string} - 光标位置之前的文本内容。
   */
  getTextPrecedingCurrentSelection() {
    const tribute = this.tribute; // 通过构造函数传入的 Tribute 实例
    const context = tribute.current; // 当前 Tribute 操作的上下文 (如绑定的元素)
    let text = "";

    if (!context || !context.element) return ""; // 上下文或元素无效，返回空

    if (!this.isContentEditable(context.element)) {
      // 处理普通 <input> 或 <textarea> 元素
      const textComponent = context.element;
      // 确保元素有 value 属性和 selectionStart (表示光标位置)
      if (textComponent.value && typeof textComponent.selectionStart === "number") {
        const startPos = textComponent.selectionStart;
        if (startPos >= 0) {
          text = textComponent.value.substring(0, startPos); // 获取从开头到光标的子串
        }
      }
    } else {
      // 处理 contentEditable 元素
      const sel = this._getWindowSelection(); // 获取 Selection 对象
      if (sel && sel.anchorNode) { // 确保有光标 (anchorNode)
        const anchorNode = sel.anchorNode; // 光标所在的节点
        // textContent 更适合获取元素及其子节点的文本内容，nodeValue 主要用于文本节点本身
        const workingNodeContent = anchorNode.textContent;
        const selectStartOffset = sel.getRangeAt(0).startOffset; // 光标在 anchorNode 内的偏移量

        if (workingNodeContent && selectStartOffset >= 0) {
          // 获取当前节点内光标前的文本
          let currentText = workingNodeContent.substring(0, selectStartOffset);

          // 尝试更智能地获取光标前所有相关文本，这部分逻辑可能很复杂，
          // 因为 contentEditable 的 DOM 结构可能多样（例如，跨多个 inline 元素）。
          // 简化的策略：如果光标在文本节点的开头 (offset=0)，则尝试拼接前一个兄弟节点的文本内容。
          // 注意：这仍然是一个简化版本，没有完全处理所有复杂的 DOM 结构和块级边界。
          text = currentText;

          // 如果光标在当前节点的开头，并且存在前一个兄弟节点，则尝试包含其文本。
          // 需要更精细地判断何时停止向前回溯 (例如遇到块级元素或 contentEditable 边界)。
          let walkerStopNode = context.element; // 默认停止回溯的边界是 contentEditable 容器本身
          let parentEditable = anchorNode;
          // 找到包含当前 anchorNode 的最近的 contentEditable 祖先，作为回溯的真正边界
          while(parentEditable && parentEditable.contentEditable !== 'true') {
            parentEditable = parentEditable.parentNode;
          }
          if (parentEditable) walkerStopNode = parentEditable; // 更新边界

          // 如果光标在当前文本节点开头 (selectStartOffset === 0) 并且有前一个兄弟节点
          if (selectStartOffset === 0 && anchorNode.previousSibling) {
              let prevNode = anchorNode.previousSibling;
              let accumulatedPrevText = "";
              // 向前回溯兄弟节点，直到遇到边界或没有更多兄弟节点
              while(prevNode && prevNode !== walkerStopNode) {
                  if (prevNode.nodeType === Node.TEXT_NODE) {
                      // 如果是文本节点，直接拼接其内容
                      accumulatedPrevText = prevNode.nodeValue + accumulatedPrevText;
                  } else if (prevNode.nodeType === Node.ELEMENT_NODE) {
                      // 如果是元素节点，判断是否应该停止或继续
                      // 如果是另一个 contentEditable 区域或非内联元素，则停止
                      if (prevNode.contentEditable === 'true' || getComputedStyle(prevNode).display !== 'inline') {
                          break;
                      }
                      // 否则，获取其文本内容并拼接
                      accumulatedPrevText = prevNode.textContent + accumulatedPrevText;
                  }
                  if (prevNode === walkerStopNode) break; // 到达边界，停止
                  prevNode = prevNode.previousSibling; // 继续前一个兄弟节点
              }
              text = accumulatedPrevText + text; // 将前面节点的文本加在当前文本之前
          }
        }
      }
    }
    return text; // 返回光标前的文本
  }

  /**
   * 从给定文本中获取最后一个“单词”。
   * “单词”的定义取决于 Tribute 是否配置了 `autocompleteSeparator`。
   * 如果配置了分隔符，则文本按分隔符分割，最后一个片段被视为“单词”。
   * 否则，文本按空白字符分割，最后一个非空部分被视为“单词”。
   * @param {string} text - 要从中提取最后一个单词的输入文本。
   * @returns {string} - 提取到的最后一个单词。如果文本为空或无法分割，则返回空字符串。
   */
  getLastWordInText(text) {
    if (!text) return ""; // 文本为空，直接返回空串
    let wordsArray;
    if (this.tribute.autocompleteSeparator) {
      // 如果配置了自动完成分隔符
      const separator = this.tribute.autocompleteSeparator;
      // 确保分隔符有效（非空且非纯空白）
      if (separator && separator.trim().length > 0) {
          // 使用正则表达式分割文本，分隔符可以是字符串或正则表达式。
          // 为了安全处理分隔符中的特殊正则字符，需要对其进行转义。
          // `(?!$)` 是一个负向前瞻断言，确保如果文本以分隔符结尾，
          // 不会将分隔符后的空字符串视为最后一个“单词”。
          const parts = text.split(new RegExp(this.escapeRegExp(separator) + '(?!$)'));
          return parts.pop() || ""; // 返回分割后的最后一部分，或空字符串
      } else {
           // 如果分隔符无效，则退回到按空白分割
           wordsArray = text.split(/\s+/);
      }
    } else {
      // 没有配置分隔符，默认按空白字符分割
      wordsArray = text.split(/\s+/);
    }
    // 返回分割后的最后一个单词，或空字符串（如果数组为空或最后一个元素是空串）
    return wordsArray.pop() || "";
  }

  /**
   * 转义字符串以便安全地用作正则表达式的一部分。
   * 将正则表达式中的特殊字符（如 `.`、`*`、`+` 等）替换为其转义形式（如 `\.`、`\*`、`\+`）。
   * @param {string} string - 需要转义的原始字符串。
   * @returns {string} - 转义后的字符串，可以直接插入到 `new RegExp()` 中。
   * @private
   */
  escapeRegExp(string) {
    // $& 表示正则表达式匹配到的整个字符串
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 判断给定的 HTML 元素是否为 contentEditable 状态。
   * 一个元素被认为是 contentEditable 如果它不是 INPUT 或 TEXTAREA 元素，
   * 并且其 `contentEditable` 属性明确设置为字符串 "true"。
   * @param {HTMLElement} element - 需要检查的 HTML 元素。
   * @returns {boolean} - 如果元素是 contentEditable 则返回 `true`，否则返回 `false`。
   */
  isContentEditable(element) {
    return (
      element.nodeName !== "INPUT" &&        // 不是 <input>
      element.nodeName !== "TEXTAREA" &&   // 也不是 <textarea>
      element.contentEditable === "true"   // 并且 contentEditable 属性值为 "true"
    );
  }

  /**
   * 将光标（插入符）放置到指定 DOM 元素的末尾。
   * @param {HTMLElement} el - 目标 DOM 元素。
   */
  placeCaretAtEnd(el) {
    // 首先尝试聚焦元素，这对于后续的选区操作可能是必要的
    if (typeof el.focus === 'function') {
        el.focus();
    }
    const doc = this._getDocument(); // 获取正确的 document 上下文
    const win = doc.defaultView || window; // 获取关联的 window 对象

    // 使用现代浏览器推荐的 Selection 和 Range API
    if (
      typeof win.getSelection !== "undefined" && // 检查 API 是否存在
      typeof doc.createRange !== "undefined"
    ) {
      const range = doc.createRange();    // 创建一个新的 Range 对象
      range.selectNodeContents(el);       // 使 Range 包含元素的所有内容
      range.collapse(false);              // 将 Range 折叠到其结束点 (false 表示折叠到末尾)
      const sel = win.getSelection();     // 获取 Selection 对象
      if (sel) {
        sel.removeAllRanges();            // 清除当前所有选区
        sel.addRange(range);              // 将新的折叠后的 Range (即光标) 添加到选区
      }
    } else if (typeof doc.body.createTextRange !== "undefined") {
      // 对于旧版 IE 浏览器，使用 TextRange API 作为后备
      const textRange = doc.body.createTextRange(); // 创建 TextRange
      textRange.moveToElementText(el);              // 将 TextRange 移动到包含元素的文本
      textRange.collapse(false);                    // 折叠到末尾
      textRange.select();                           // 应用选区
    }
  }

  /**
   * 在 contentEditable 元素中的当前光标位置插入文本。
   * 如果当前存在选区，则选区内容会被替换为新文本。
   * @param {string} text - 要插入的文本字符串。
   */
  insertTextAtCursor(text) {
    const sel = this._getWindowSelection(); // 获取 Selection 对象
    // 如果没有选区或选区中没有 Range，则无法操作
    if (!sel || sel.rangeCount === 0) return;

    const doc = this._getDocument(); // 获取正确的 document
    const range = sel.getRangeAt(0);   // 获取当前选区的第一个 Range
    range.deleteContents();            // 删除当前选区覆盖的内容 (如果是光标，则不删除任何内容)

    const textNode = doc.createTextNode(text); // 创建一个新的文本节点包含要插入的文本
    range.insertNode(textNode);                // 在 Range 的位置插入文本节点

    // 将光标移动到新插入的文本之后
    range.setStartAfter(textNode); // 设置 Range 的起始点在文本节点之后
    range.collapse(true);          // 折叠 Range，形成光标
    sel.removeAllRanges();         // 清除旧选区
    sel.addRange(range);           // 应用新选区 (光标)
  }

  /**
   * 在普通输入框（<input> 或 <textarea>）的当前光标位置插入文本。
   * 如果存在选区，则选区内容会被替换。
   * @param {HTMLInputElement|HTMLTextAreaElement} textarea - 目标输入框元素。
   * @param {string} text - 要插入的文本字符串。
   */
  insertAtCaret(textarea, text) {
    const scrollPos = textarea.scrollTop;         // 保存当前的滚动位置，以便后续恢复
    const caretPos = textarea.selectionStart;     // 获取光标的起始位置（对于选区也是起点）
    const front = textarea.value.substring(0, caretPos); // 光标前的文本
    const back = textarea.value.substring(
      textarea.selectionEnd, // 光标（或选区）结束位置后的文本
      textarea.value.length
    );

    // 构建新的输入框值：光标前文本 + 要插入的文本 + 光标后文本
    textarea.value = front + text + back;
    // 更新光标位置到插入文本之后
    const newCaretPos = caretPos + text.length;
    textarea.selectionStart = newCaretPos;
    textarea.selectionEnd = newCaretPos;

    // 尝试重新聚焦输入框
    if (typeof textarea.focus === 'function') {
        textarea.focus();
    }
    textarea.scrollTop = scrollPos; // 恢复滚动位置，避免插入文本导致滚动条跳动
  }
}

export default CaretUtils;
