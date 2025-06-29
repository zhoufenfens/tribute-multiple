// src/PositionUtils.js

/**
 * @class PositionUtils
 * @classdesc 提供与元素定位（特别是提及菜单的定位）相关的实用函数。
 *            此类的方法主要由 TributeRange 或 TributeMenu 类调用，以计算和应用菜单的位置。
 *            它处理了在不同类型的输入元素（input, textarea, contentEditable）中获取光标位置，
 *            以及根据视窗边界调整菜单位置（翻转逻辑）等复杂性。
 */
class PositionUtils {
  /**
   * PositionUtils 构造函数。
   * @param {Tribute} tribute - Tribute 主实例的引用。用于访问配置和上下文信息，如 iframe。
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
    // 这个辅助方法理想情况下应该集中化（如果被多个工具类使用），
    // 或者每个工具类根据其具体需求管理自己的 document/window 上下文。
    // 目前，为了保持类的独立性，这里复制了 CaretUtils 中的简化逻辑。
    let iframe;
    if (this.tribute.current && this.tribute.current.collection) {
      iframe = this.tribute.current.collection.iframe;
    } else if (this.tribute.collection && this.tribute.collection.length > 0) {
      // 如果当前没有活动集合，尝试使用第一个集合的 iframe 配置作为后备
      iframe = this.tribute.collection[0].iframe;
    }

    if (!iframe) {
      return document; // 无 iframe，使用主文档
    }
    // 返回 iframe 内部的 document
    return iframe.contentWindow.document;
  }

  /**
   * 获取当前操作环境的 `window` 对象。
   * @returns {Window} 当前的 `window` 对象。
   * @private
   */
  _getWindow() {
    const doc = this._getDocument(); // 获取当前 document
    return doc.defaultView || window; // 返回 document 关联的 window，或全局 window 作为后备
  }

  /**
   * 获取提及菜单的实际尺寸（宽度和高度）。
   * 为了准确测量，菜单元素必须在 DOM 中并且可见（即使是短暂地、在屏幕外）。
   * @returns {{width: number, height: number}} 包含菜单宽度和高度的对象。如果无法测量，则返回 {width: 0, height: 0}。
   */
  getMenuDimensions() {
    // 假设 this.tribute.menu.menu 是实际的菜单 DOM 元素 (通常是 <ul> 或其容器 <div>)
    const menuElement = this.tribute.menu.menu;
    if (!menuElement) return { width: 0, height: 0 }; // 菜单元素不存在，无法测量

    const dimensions = {
      width: null,
      height: null,
    };

    // 保存菜单原始的 style.cssText，以便后续恢复
    const originalCssText = menuElement.style.cssText;
    // 临时将菜单设置为可见但移出屏幕外，以便浏览器计算其尺寸
    menuElement.style.cssText = `
      position: fixed;      /* 使用 fixed 定位，使其尺寸不受父容器影响 */
      top: -9999px;         /* 移到屏幕上方不可见区域 */
      left: -9999px;        /* 移到屏幕左方不可见区域 */
      display: block;       /* 确保是块级元素，以便正确计算 offsetWidth/Height */
      visibility: hidden;   /* 设置为不可见，但仍占据布局空间 */
    `;
    // 注意：移除了 max-height 限制，以获取菜单内容的完整自然高度

    dimensions.width = menuElement.offsetWidth;   // 获取菜单的实际渲染宽度
    dimensions.height = menuElement.offsetHeight; // 获取菜单的实际渲染高度

    menuElement.style.cssText = originalCssText; // 恢复菜单原始的样式

    return dimensions; // 返回测量到的尺寸
  }

  /**
   * 获取 `<input>` 或 `<textarea>` 元素中模拟光标位置的坐标。
   * 这个方法通过创建一个隐藏的 "镜像" `<div>` 来模拟输入元素内的文本布局，
   * 从而计算出指定文本位置（`position`）在页面上的精确坐标。
   * 这些坐标随后可用于定位提及菜单。
   * @param {HTMLInputElement|HTMLTextAreaElement} element - 目标输入元素。
   * @param {number} position - 文本中光标的索引位置（从0开始）。
   * @returns {object} 一个包含 `top`, `left`, 和 `height` (模拟光标所在行的高度) 的坐标对象。
   * @private
   */
  _getTextAreaOrInputUnderlinePosition(element, position) {
    const doc = this._getDocument(); // 获取正确的 document
    const win = this._getWindow();   // 获取正确的 window

    // 需要从原始输入元素复制到镜像 div 的 CSS 属性列表，以确保布局一致
    const properties = [
      "direction", "boxSizing", "width", "height", "overflowX", "overflowY",
      "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontSizeAdjust",
      "lineHeight", "fontFamily", "textAlign", "textTransform", "textIndent",
      "textDecoration", "letterSpacing", "wordSpacing", "whiteSpace" // whiteSpace 很重要
    ];

    // 创建镜像 div
    const div = doc.createElement("div");
    div.id = "input-textarea-caret-position-mirror-div"; // 给ID方便调试
    doc.body.appendChild(div); // 附加到 body 以便计算布局

    const style = div.style; // 镜像 div 的 style 对象
    const computed = win.getComputedStyle(element); // 获取输入元素的计算样式

    // 设置镜像 div 的基本样式
    style.whiteSpace = "pre-wrap"; // 对于 textarea，允许文本换行并保留空白符
    if (element.nodeName !== "INPUT") {
      style.wordWrap = "break-word"; // 仅对 textarea 应用，允许单词内换行
    } else {
      style.whiteSpace = "pre"; // 对于 input，通常文本不换行，保留空白符
    }
    style.position = "absolute";  // 绝对定位，不影响页面其他部分
    style.visibility = "hidden";  // 隐藏，但仍参与布局计算

    // 将输入元素的关键 CSS 属性复制到镜像 div
    properties.forEach((prop) => {
      style[prop] = computed[prop];
    });

    // 注意：原始代码中关于 Firefox 的特定处理已被移除，假设现代浏览器行为更一致。
    // style.overflow = "hidden"; // 隐藏溢出内容，模拟输入字段的行为

    // 在镜像 div 中放入光标位置之前的文本
    div.textContent = element.value.substring(0, position);

    // 对于 <input> 元素，将空格替换为不换行空格 (nbsp)，以确保宽度计算正确
    if (element.nodeName === "INPUT") {
      div.textContent = div.textContent.replace(/\s/g, "\u00a0");
    }

    // 创建一个空的 <span> 元素代表光标本身，插入到光标位置之前的文本之后
    // 这个 span 的位置将用于确定光标的坐标
    const span = doc.createElement("span");
    // 可以给 span 一个零宽度字符内容，如 '&#x200B;' (Zero Width Space)，
    // 有时有助于更精确地测量，但通常空 span 的 offsetLeft/Top 已经足够。
    // span.textContent = element.value.substring(position) || "."; // 原代码逻辑，用点填充空余部分测量
    div.appendChild(span); // 将代表光标的 span 添加到镜像 div

    // 获取输入元素的边界矩形 (相对于视口)
    // const rect = element.getBoundingClientRect();
    // const mirrorRect = div.getBoundingClientRect(); // 镜像div的边界矩形
    // const spanRect = span.getBoundingClientRect(); // 代表光标的span的边界矩形

    // 保存输入元素的滚动位置，因为镜像 div 不会同步滚动
    const scrollTop = element.scrollTop;
    const scrollLeft = element.scrollLeft;

    // 测量完毕后，从 DOM 中移除镜像 div
    // doc.body.removeChild(div); // 移到下面更健壮的测量方法之后

    // --- 更健壮的光标位置测量方法 ---
    // 创建三个 span：光标前文本、光标标记、光标后文本。测量光标标记 span 的位置。
    const mirrorDivRobust = doc.createElement('div');
    doc.body.appendChild(mirrorDivRobust);
    const mirrorStyleRobust = mirrorDivRobust.style;
    mirrorStyleRobust.whiteSpace = 'pre-wrap';
    if (element.nodeName !== 'INPUT') mirrorStyleRobust.wordWrap = 'break-word';
    mirrorStyleRobust.position = 'absolute';
    mirrorStyleRobust.visibility = 'hidden';
    properties.forEach(prop => mirrorStyleRobust[prop] = computed[prop]);

    const textBefore = element.value.substring(0, position);
    const textAfter = element.value.substring(position);

    const spanBefore = doc.createElement('span');
    spanBefore.textContent = textBefore;
    mirrorDivRobust.appendChild(spanBefore);

    const caretSpan = doc.createElement('span'); // 这个 span 代表光标本身
    mirrorDivRobust.appendChild(caretSpan);

    if (textAfter) { // 如果光标后有文本，也添加到镜像中
        const spanAfter = doc.createElement('span');
        spanAfter.textContent = textAfter;
        mirrorDivRobust.appendChild(spanAfter);
    }

    // 将镜像 div 精确覆盖在原始输入元素之上，以便 getBoundingClientRect 提供正确的视口坐标
    const elementRect = element.getBoundingClientRect();
    mirrorStyleRobust.position = 'fixed'; // 使用 fixed 定位，以便坐标相对于视口
    mirrorStyleRobust.left = `${elementRect.left}px`;
    mirrorStyleRobust.top = `${elementRect.top}px`;
    mirrorStyleRobust.width = `${elementRect.width}px`;   // 确保宽度一致
    mirrorStyleRobust.height = `${elementRect.height}px`; // 确保高度一致 (可选，但有助于调试)
    mirrorDivRobust.scrollTop = scrollTop;   // 同步滚动位置
    mirrorDivRobust.scrollLeft = scrollLeft;

    const caretRect = caretSpan.getBoundingClientRect(); // 获取代表光标的 span 的边界矩形
    doc.body.removeChild(mirrorDivRobust); // 移除健壮的镜像 div
    if (div.parentNode) doc.body.removeChild(div); // 同时移除之前的简单镜像 div (如果还在的话)


    // caretRect.left 是光标的视口X坐标
    // caretRect.top + caretRect.height 是光标基线的视口Y坐标 (用于在其下方定位菜单)
    // 需要减去输入元素内部的滚动量，得到相对于元素内容起始点的坐标
    return {
        top: caretRect.top + caretRect.height - scrollTop, // Y坐标 (已考虑元素内滚动)
        left: caretRect.left - scrollLeft,                 // X坐标 (已考虑元素内滚动)
        height: caretRect.height                           // 光标所在行的大致高度
    };
  }

  /**
   * 获取 contentEditable 元素中光标的精确位置坐标。
   * @param {number} selectedNodePosition - 光标在当前选区锚点节点 (`sel.anchorNode`) 内的偏移量。
   * @returns {object} 一个包含 `top`, `left`, `height` (光标所在行高度) 的坐标对象。
   *                   如果无法获取坐标，则返回 {top: 0, left: 0, height: 0}。
   * @private
   */
  _getContentEditableCaretPosition(selectedNodePosition) {
    const doc = this._getDocument(); // 获取正确的 document
    const win = this._getWindow();   // 获取正确的 window
    const sel = win.getSelection();  // 获取当前选区对象
    // 如果没有选区或选区中没有 Range，则无法计算
    if (!sel || sel.rangeCount === 0) return { top: 0, left: 0, height: 0 };

    const range = sel.getRangeAt(0).cloneRange(); // 克隆当前选区的第一个 Range

    // 如果 Range 是折叠的 (即光标状态)，并且提供了 selectedNodePosition，
    // 我们可能需要确保 Range 精确地反映这个位置。
    // 通常，getRangeAt(0) 已经代表了当前光标。
    // 如果 selectedNodePosition 与 range.startOffset 不同，
    // 表明调用者可能有一个比当前选区起点更精确的位置。
    // 为简单起见，假设 selectedNodePosition 就是当前光标在 anchorNode 中的偏移量。
    if (range.collapsed && sel.anchorNode) {
        try {
            // 确保 Range 设置到精确的位置 (如果 selectedNodePosition 可靠)
             range.setStart(sel.anchorNode, selectedNodePosition);
             range.setEnd(sel.anchorNode, selectedNodePosition);
        } catch (e) {
            // console.warn("PositionUtils._getContentEditableCaretPosition: 设置 Range 时出错。", e);
            // 如果设置失败，则回退到使用现有的 Range
        }
    }

    let rect; // 用于存储光标位置的边界矩形
    // 尝试使用 `range.getClientRects()` 获取光标位置。
    // 这通常是获取 contentEditable 中光标位置的推荐方法。
    if (range.getClientRects) {
      const rects = range.getClientRects();
      if (rects.length > 0) {
        rect = rects[0]; // 第一个矩形通常代表光标位置
      }
    }

    // 如果 `getClientRects` 不可用或未返回任何矩形 (例如，在某些浏览器或特定情况下)
    if (!rect) {
        // 使用后备方法：创建一个临时的内联元素 (span) 来测量位置
        const span = doc.createElement("span");
        // 使用零宽度空格 (&#x200B;) 作为内容，确保 span 有布局但不可见
        span.innerHTML = '&#x200B;';
        range.insertNode(span); // 在 Range 的位置插入 span
        rect = span.getBoundingClientRect(); // 获取 span 的边界矩形
        const spanParent = span.parentNode;
        if (spanParent) { // 确保父节点存在再移除
            spanParent.removeChild(span); // 移除临时 span
        }
        // 恢复选区：插入节点可能会改变选区。
        // 尝试恢复原始 Range。
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // 返回计算得到的坐标和高度
    return {
        top: rect.top,        // 相对于视口的顶部距离
        left: rect.left,      // 相对于视口的左侧距离
        height: rect.height,  // 光标所在行的高度 (或 Range 的高度)
    };
  }

  /**
   * 将提及菜单定位到计算出的光标（插入符）位置。
   * 此方法还处理菜单的视窗边界检查和翻转逻辑（如果菜单会超出屏幕）。
   * @param {object} caretPos - 光标的位置坐标对象，应包含 `top`, `left`, `height` 属性。
   * @param {HTMLElement} menuElement - 要定位的菜单的 DOM 元素。
   * @param {boolean} scrollTo - 是否在定位后尝试将菜单滚动到视图中。
   */
  positionMenuAtCaretCoordinates(caretPos, menuElement, scrollTo) {
    // 如果菜单元素不存在，或者 Tribute 配置禁用了菜单定位，则直接显示菜单（如果存在）并返回
    if (!menuElement || !this.tribute.positionMenu) {
      if (menuElement) menuElement.style.cssText = "display: block;"; // 简单显示
      return;
    }

    const win = this._getWindow();   // 获取当前 window 对象
    const doc = this._getDocument(); // 获取当前 document 对象 (此处主要用于一致性)

    const menuDimensions = this.getMenuDimensions(); // 获取菜单的实际渲染尺寸
    let { top, left } = caretPos; // 从传入的 caretPos 对象解构 top 和 left
    // 使用光标所在行的高度，或者菜单的自然高度作为后备，用于在光标下方定位菜单
    const lineHeight = caretPos.height || menuDimensions.height;

    top += lineHeight; // 默认将菜单定位在光标所在行的下方

    // 初始 CSS 设置：使用 fixed 定位以便进行基于视口的翻转计算，并设置为可见
    let cssText = `
        position: fixed;
        display: block;
        top: ${top}px;
        left: ${left}px;
        max-height: ${menuDimensions.maxHeight || 500}px; /* 应用配置或默认的最大高度 */
        max-width: ${menuDimensions.maxWidth || 300}px;   /* 应用配置或默认的最大宽度 */
    `;

    menuElement.style.cssText = cssText; // 应用初始样式，以便测量其在视口中的位置

    // --- 菜单翻转逻辑 ---
    const menuRect = menuElement.getBoundingClientRect(); // 获取菜单当前的边界矩形 (基于 fixed 定位)

    // 垂直方向翻转：如果菜单底部超出视窗高度
    if (menuRect.bottom > win.innerHeight) {
        const spaceAbove = caretPos.top; // 光标行上方的可用空间
        // 如果上方空间足够容纳菜单，则将菜单翻转到光标行上方
        if (spaceAbove > menuDimensions.height) {
            top = caretPos.top - menuDimensions.height; // 新的 top 位置
        } else {
            // 如果上方空间不足，尝试将菜单限制在视窗内，或者贴近视窗底部/顶部
            top = Math.max(0, win.innerHeight - menuDimensions.height);
        }
    }

    // 水平方向翻转：如果菜单右侧超出视窗宽度
    if (menuRect.right > win.innerWidth) {
        // caretPos.left 是光标开始的X坐标, caretPos.width 是光标/选区的宽度 (如果有)
        const spaceLeftOfCaretEnd = caretPos.left + (caretPos.width || 0);
        // 如果光标右侧的空间足够容纳菜单 (从光标结束点向左计算)，则翻转到左侧
        if (spaceLeftOfCaretEnd > menuDimensions.width) {
            left = caretPos.left - menuDimensions.width; // 新的 left 位置
        } else {
            // 否则，限制在视窗内，或贴近视窗右侧/左侧
            left = Math.max(0, win.innerWidth - menuDimensions.width);
        }
    }

    // 确保最终的 left 和 top 值不会使菜单部分移出视窗左侧或顶部
    left = Math.max(0, left);
    top = Math.max(0, top);

    // --- 最终定位 ---
    // 判断菜单容器是否为 document.body。如果是，则使用 fixed 定位；否则使用 absolute 定位。
    const isBodyContainer = !this.tribute.menuContainer || this.tribute.menuContainer === doc.body;
    const positionStyle = isBodyContainer ? 'fixed' : 'absolute';

    // 如果菜单容器不是 body (即用户指定了特定的 menuContainer)
    if (!isBodyContainer) {
        // 需要将基于视口的坐标 (top, left) 转换为相对于 menuContainer 的坐标
        const containerRect = this.tribute.menuContainer.getBoundingClientRect();
        const containerScrollTop = this.tribute.menuContainer.scrollTop;
        const containerScrollLeft = this.tribute.menuContainer.scrollLeft;

        // 重新计算 left 和 top，使其相对于 menuContainer
        left = caretPos.left - containerRect.left + containerScrollLeft;
        // top = caretPos.top - containerRect.top + lineHeight + containerScrollTop; // 原始逻辑
        // 修正：如果已经过翻转，top 可能是翻转后的值，应基于翻转后的 top 计算
        top = (top === caretPos.top + lineHeight) // 判断是否仍在光标下方
            ? (caretPos.top - containerRect.top + lineHeight + containerScrollTop) // 在下方
            : (caretPos.top - containerRect.top - menuDimensions.height + containerScrollTop); // 已翻转到上方


        // 注意：当 menuContainer 存在时，翻转逻辑可能需要重新评估，
        // 因为此时的边界是 menuContainer 而不是整个视窗。
        // 为简化，当前假设基于视口的初始翻转已足够，或者在特定容器内的翻转不那么关键。
    }

    // 应用最终计算出的样式
    menuElement.style.top = `${top}px`;
    menuElement.style.left = `${left}px`;
    menuElement.style.position = positionStyle;

    // 清除可能冲突的 right 和 bottom 样式，确保由 top 和 left 控制位置
    menuElement.style.right = 'auto';
    menuElement.style.bottom = 'auto';

    // 如果需要，将菜单滚动到视图中
    if (scrollTo) {
      this.scrollIntoView(menuElement);
    }
  }

  /**
   * 将指定的 DOM 元素滚动到浏览器视窗的可视区域内。
   * 如果元素部分或完全不可见，此方法会尝试将其滚动到最近的可见位置。
   * @param {HTMLElement} elem - 需要滚动到视图的 DOM 元素。
   * @private
   */
  scrollIntoView(elem) {
    const win = this._getWindow(); // 获取当前 window
    // const reasonableBuffer = 20; // 距离视窗边缘的缓冲空间 (原始逻辑，暂未使用)
    let clientRect = elem.getBoundingClientRect(); // 获取元素的边界矩形

    // 此滚动逻辑相对简单，可能无法完美处理所有复杂的滚动容器场景。
    // 现代浏览器提供了 `element.scrollIntoView({behavior: 'smooth', block: 'nearest'})`，
    // 这通常是更优选的方法，因为它能更好地处理嵌套滚动和提供平滑滚动选项。

    // 如果元素的顶部在视窗之上，或者底部在视窗之下 (即垂直方向部分或完全不可见)
    if (clientRect.top < 0 || clientRect.bottom > win.innerHeight) {
        // 尝试使用现代的 scrollIntoView API
        if (typeof elem.scrollIntoView === "function") {
            try {
                // 将元素滚动到最近的块级和内联边缘，使其可见
                elem.scrollIntoView({ block: "nearest", inline: "nearest" });
            } catch (e) {
                // 如果不支持选项对象 (旧版浏览器)，则使用布尔参数回退
                // false 参数通常表示将元素的底部与视窗底部对齐 (如果元素在下方)
                // 或顶部与顶部对齐 (如果元素在上方)
                elem.scrollIntoView(false);
            }
        }
    }
    // 水平方向的滚动处理可以根据需要添加。
  }
}

export default PositionUtils;
