// src/TributeMenuEvents.js

/**
 * @class TributeMenuEvents
 * @classdesc 处理附加到提及菜单（ul元素）的事件。
 */
class TributeMenuEvents {
  /**
   * 构造函数
   * @param {Tribute} tribute - Tribute 主实例的引用。
   */
  constructor(tribute) {
    this.tribute = tribute;
    // this.tribute.menuEvents = this; // 主实例中已设置
    // this.menu 通常指 this.tribute.menu.menu (实际的 ul DOM 元素)
  }

  /**
   * 将事件监听器绑定到指定的菜单 DOM 元素。
   * @param {HTMLElement} menuElement - 要绑定事件的菜单 DOM 元素 (ul)。
   */
  bind(menuElement) {
    // 确保 this.tribute.menu.menu 存在
    if (!menuElement) {
        console.warn("TributeMenuEvents.bind: menuElement is not defined.");
        return;
    }

    // menuElement 是 this.tribute.menu.menu
    // click 事件处理菜单项选择
    this.menuClickEvent = this.click.bind(this, this.tribute);
    // mouseover 事件处理高亮（如果需要，或者mousemove已在TributeMenu中处理）
    // this.menuMouseOverEvent = this.mouseover.bind(this, this.tribute);

    // 滚动和窗口大小调整事件，用于在特定情况下隐藏菜单
    this.menuContainerScrollEvent = this.debounce(() => {
      if (this.tribute.isActive) {
        this.tribute.hideMenu();
      }
    }, 10, false);

    this.windowResizeEvent = this.debounce(() => {
      if (this.tribute.isActive) {
        this.tribute.hideMenu();
      }
    }, 10, false);

    // 事件监听器添加到 document 或特定容器
    const doc = this.tribute.range.getDocument();
    doc.addEventListener("mousedown", this.menuClickEvent, false);
    // IE11的指针事件支持
    if (doc.addEventListenerMSPointerDown) { // 自定义检查，标准为 'MSPointerDown'
        doc.addEventListener("MSPointerDown", this.menuClickEvent, false);
    }

    window.addEventListener("resize", this.windowResizeEvent);

    const menuContainer = this.tribute.menuContainer || window;
    menuContainer.addEventListener("scroll", this.menuContainerScrollEvent, true); // Use capture for window scroll
  }

  /**
   * 从指定的菜单 DOM 元素解绑事件监听器。
   * @param {HTMLElement} menuElement - 要解绑事件的菜单 DOM 元素 (ul)。
   */
  unbind(menuElement) {
    if (!menuElement) {
        // console.warn("TributeMenuEvents.unbind: menuElement is not defined.");
        // 即使 menuElement 为空（可能已销毁），仍尝试解绑全局监听器
    }

    const doc = this.tribute.range.getDocument();
    doc.removeEventListener("mousedown", this.menuClickEvent, false);
    if (doc.removeEventListenerMSPointerDown) {
        doc.removeEventListener("MSPointerDown", this.menuClickEvent, false);
    }

    window.removeEventListener("resize", this.windowResizeEvent);

    const menuContainer = this.tribute.menuContainer || window;
    menuContainer.removeEventListener("scroll", this.menuContainerScrollEvent, true);
  }

  /**
   * 处理菜单上的点击事件（委托到 document）。
   * `this` 在这里指向 TributeMenuEvents 实例。
   * @param {Tribute} tributeInstance - Tribute 主实例的引用。
   * @param {MouseEvent} event - 鼠标事件对象。
   */
  click(tributeInstance, event) {
    const menu = tributeInstance.menu.menu; // 获取实际的菜单DOM元素
    if (!tributeInstance.isActive || !menu) return;

    const target = event.target;

    // 检查点击是否在菜单内部的 <li> 元素上
    let li = target;
    let isTargetLiChild = false;

    // 向上遍历DOM树，直到找到 <li> 或菜单本身
    while (li && li !== menu) {
        if (li.nodeName.toLowerCase() === "li") {
            isTargetLiChild = true;
            break;
        }
        li = li.parentNode;
    }

    if (isTargetLiChild && li.hasAttribute("data-index")) {
      // 点击在菜单项上
      event.preventDefault();
      event.stopPropagation();

      if (tributeInstance.current.collection && tributeInstance.current.collection.multipleSelectMode) {
        // 多选模式下，点击列表项应切换其勾选状态
        const checkbox = li.querySelector('.tribute-menu-item-checkbox');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          // 手动触发checkbox的click事件来调用toggleItemSelected, 或者直接调用:
          const itemId = checkbox.dataset.id;
          // 找到原始 item 数据。这部分可能需要优化，比如在 li 上直接存储原始数据或其引用。
          // 假设 Tribute.js 的 current.filteredItems[index].original 仍然是可靠的来源。
          const itemIndex = parseInt(li.getAttribute("data-index"), 10);
          const originalItem = tributeInstance.current.filteredItems[itemIndex]?.original;
          if (itemId && originalItem) {
            tributeInstance.toggleItemSelected(itemId, checkbox.checked, originalItem);
          }
        }
        // 在多选模式下，点击列表项后不应关闭菜单
      } else {
        // 单选模式下，直接选择
        tributeInstance.selectItemAtIndex(li.getAttribute("data-index"), event);
      }
    } else if (menu.contains(target)) {
      // 点击在菜单内部，但不是可选择的 li (例如，NoMatchTemplate 内容)
      // 或者点击的是多选模式下的按钮区域
      const isButtonClicked = target.closest('.tribute-menu-buttons');
      if (isButtonClicked) {
        // 如果点击的是按钮，事件已由按钮自身处理，这里不需要额外操作，也不应关闭菜单。
        return;
      }
       event.preventDefault(); // 阻止可能的文本选择等行为
    } else {
      // 点击在菜单外部
      // 检查点击目标是否是触发 Tribute 的元素本身
      // 如果是，则不隐藏菜单，因为输入事件会处理
      if (target !== tributeInstance.current.element) {
          tributeInstance.current.externalTrigger = false; // 重置外部触发标记
          tributeInstance.hideMenu();
      }
    }
  }

  /**
   * Debounce 函数，用于限制函数调用频率。
   * @param {Function} func - 要执行的函数。
   * @param {number} wait - 等待时间（毫秒）。
   * @param {boolean} immediate - 是否立即执行一次。
   * @returns {Function} - Debounced 函数。
   */
  debounce(func, wait, immediate) {
    let timeout;
    return (...args) => { // 使用 rest parameters
      const context = this; // 保存 this 上下文
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }
}

export default TributeMenuEvents;
