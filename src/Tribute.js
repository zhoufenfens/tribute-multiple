// src/Tribute.js
import "./utils"; // Polyfills
import TributeConfig from "./TributeConfig";
import TributeMenu from "./TributeMenu";
import TributeEvents from "./TributeEvents"; // Handles input element events
import TributeMenuEvents from "./TributeMenuEvents"; // Handles menu element events
import TributeRange from "./TributeRange"; // Handles selection, cursor, and text manipulation
import TributeSearch from "./TributeSearch"; // Handles search and filtering

/**
 * @class Tribute
 * @classdesc 主 Tribute 类，协调所有功能。
 */
class Tribute {
  /**
   * 构造函数
   * @param {object} options - Tribute 的配置选项。
   */
  constructor(options) {
    // 初始化配置
    this.config = new TributeConfig(options);
    this.config.setTributeInstance(this); // 将此Tribute实例传递给配置对象

    // 初始化状态
    this.menuSelected = 0; // 当前选中的菜单项索引
    this.current = {}; // 当前活动状态（例如，元素、提及文本）
    this.inputEvent = false; // 标记是否由输入事件触发
    this._isActive = false; // 内部状态，标记菜单是否激活
    this.hasTrailingSpace = false; // 标记提及文本后是否有尾随空格
    this.currentMentionTextSnapshot = ""; // 用于比较提及文本是否变化的快照
    this.selectedItems = new Map(); // 用于多选模式下存储已勾选的项 {itemId: itemObject}

    // 初始化模块实例
    // 这些模块将接收此 Tribute 实例的引用，以便它们可以回调或访问其状态/方法
    this.range = new TributeRange(this);
    this.events = new TributeEvents(this); // 绑定到输入元素的事件处理器
    this.menuEvents = new TributeMenuEvents(this); // 绑定到菜单元素的事件处理器
    this.search = new TributeSearch(this);
    this.menu = new TributeMenu(this); // 菜单管理器实例

    // 从配置中提取一些常用属性到顶层，方便访问
    this.autocompleteMode = this.config.autocompleteMode;
    this.autocompleteSeparator = this.config.autocompleteSeparator;
    this.allowSpaces = this.config.allowSpaces;
    this.replaceTextSuffix = this.config.replaceTextSuffix;
    this.positionMenu = this.config.positionMenu;
    this.spaceSelectsMatch = this.config.spaceSelectsMatch;
    this.collection = this.config.collection; // 主集合也由 config 管理
    this.menuContainer = this.config.menuContainer; // 菜单容器也由 config 管理
  }

  /**
   * 获取菜单是否激活的状态。
   * @returns {boolean}
   */
  get isActive() {
    return this._isActive;
  }

  /**
   * 设置菜单的激活状态，并在状态改变时分发事件。
   * @param {boolean} val - 新的激活状态。
   */
  set isActive(val) {
    if (this._isActive !== val) {
      this._isActive = val;
      if (this.current && this.current.element) {
        const activeEvent = new CustomEvent(`tribute-active-${val}`);
        this.current.element.dispatchEvent(activeEvent);
      }
    }
  }

  /**
   * 获取所有配置的触发字符。
   * @returns {string[]} - 触发字符数组。
   */
  triggers() {
    return this.config.triggers();
  }

  /**
   * 将 Tribute 附加到一个或多个 DOM 元素。
   * @param {Element|NodeList|Array|jQuery} el - 要附加到的 DOM 元素。
   */
  attach(el) {
    if (!el) {
      throw new Error("[Tribute] Must pass in a DOM node or NodeList.");
    }

    // 处理 jQuery 集合
    if (typeof jQuery !== "undefined" && el instanceof jQuery) {
      el = el.get();
    }

    // 处理数组或类数组对象
    if (
      el.constructor === NodeList ||
      el.constructor === HTMLCollection ||
      el.constructor === Array
    ) {
      const length = el.length;
      for (let i = 0; i < length; ++i) {
        this._attach(el[i]);
      }
    } else {
      this._attach(el);
    }
  }

  /**
   * 将 Tribute 附加到单个 DOM 元素。
   * @param {Element} el - 要附加到的 DOM 元素。
   * @private
   */
  _attach(el) {
    if (el.hasAttribute("data-tribute")) {
      console.warn(`Tribute was already bound to ${el.nodeName}`);
      return;
    }

    this.ensureEditable(el);
    this.events.bind(el); // 使用 TributeEvents 模块绑定事件
    el.setAttribute("data-tribute", true);

    // 如果元素有关联的菜单（例如之前创建的），确保其事件也被绑定
    if (el.tributeMenu && this.menuEvents) {
        this.menuEvents.bind(el.tributeMenu);
    }
  }

  /**
   * 确保元素是可编辑的（输入框、文本区域或 contentEditable）。
   * @param {Element} element - 要检查的元素。
   */
  ensureEditable(element) {
    if (TributeConfig.inputTypes().indexOf(element.nodeName) === -1) {
      if (!element.contentEditable) {
        throw new Error(
          `[Tribute] Cannot bind to ${element.nodeName}, not contentEditable`
        );
      }
    }
  }

  /**
   * 为指定元素显示提及菜单。
   * 此方法现在委托给 TributeMenu 实例。
   * @param {HTMLElement} element - 触发提及的输入元素。
   * @param {boolean} scrollTo - 是否滚动到菜单位置。
   */
  showMenuFor(element, scrollTo) {
    this.menu.showMenuFor(element, scrollTo);
  }

   /**
   * 设置当前活动的列表项（高亮）。
   * @param {number|string} index - 列表项的索引。
   */
  setActiveLi(index) {
    const lis = this.menu.menu.querySelectorAll("li"); // menu 实例现在持有 DOM 引用
    const length = lis.length >>> 0;

    if (index !== undefined) this.menuSelected = parseInt(index);

    for (let i = 0; i < length; i++) {
      const li = lis[i];
      if (i === this.menuSelected) {
        li.classList.add(this.current.collection.selectClass);

        // 滚动到视图逻辑
        const liClientRect = li.getBoundingClientRect();
        const menuClientRect = this.menu.menu.getBoundingClientRect();

        if (liClientRect.bottom > menuClientRect.bottom) {
          const scrollDistance = liClientRect.bottom - menuClientRect.bottom;
          this.menu.menu.scrollTop += scrollDistance;
        } else if (liClientRect.top < menuClientRect.top) {
          const scrollDistance = menuClientRect.top - liClientRect.top;
          this.menu.menu.scrollTop -= scrollDistance;
        }
      } else {
        li.classList.remove(this.current.collection.selectClass);
      }
    }
  }


  /**
   * 查找事件目标所在的 <li> 元素及其索引。
   * 此方法现在委托给 TributeMenu 实例。
   * @param {HTMLElement} el - 事件目标元素。
   * @returns {Array}
   * @private
   */
  _findLiTarget(el) {
    return this.menu._findLiTarget(el);
  }

  /**
   * 为指定的集合显示菜单。
   * @param {HTMLElement} element - 目标元素。
   * @param {number} [collectionIndex=0] - 要使用的集合的索引。
   */
  showMenuForCollection(element, collectionIndex = 0) {
    if (element !== this.range.getDocument().activeElement) { // 使用 range 获取 document
      this.range.placeCaretAtEnd(element);
    }

    this.current.collection = this.collection[collectionIndex];
    this.current.externalTrigger = true;
    this.current.element = element;

    const triggerChar = this.current.collection.trigger;
    if (element.isContentEditable) {
      this.range.insertTextAtCursor(triggerChar);
    } else {
      this.range.insertAtCaret(element, triggerChar);
    }

    this.showMenuFor(element, true);
  }

  /**
   * 隐藏提及菜单。
   * 此方法现在委托给 TributeMenu 实例。
   * 隐藏后清理当前状态。
   */
  hideMenu() {
    this.menu.hideMenu();
    // 清理 Tribute 实例的状态
    this.current = {};
    this.currentMentionTextSnapshot = "";
  }

  /**
   * 根据索引选择菜单项。
   * 此方法现在委托给 TributeMenu 实例。
   * @param {number | string} index - 要选择的菜单项的索引。
   * @param {Event} originalEvent - 触发选择的原始事件。
   */
  selectItemAtIndex(index, originalEvent) {
    this.menu.selectItemAtIndex(index, originalEvent);
  }

  /**
   * 替换文本内容。
   * @param {string} content - 要插入的内容。
   * @param {Event} originalEvent - 原始事件。
   * @param {object} item - 选择的原始项目对象。
   */
  replaceText(content, originalEvent, item) {
    this.range.replaceTriggerText(content, true, true, originalEvent, item);
  }

  /**
   * 内部方法，用于向集合追加值。
   * @param {object} collection - 要修改的集合对象。
   * @param {Array} newValues - 要追加的新值。
   * @param {boolean} replace - 是否替换现有值。
   * @private
   */
  _append(collection, newValues, replace) {
    if (typeof collection.values === "function") {
      throw new Error("Unable to append to values, as it is a function.");
    } else if (!replace) {
      collection.values = collection.values.concat(newValues);
    } else {
      collection.values = newValues;
    }
  }

  /**
   * 向指定索引的集合追加值。
   * @param {number | string} collectionIndex - 集合的索引。
   * @param {Array} newValues - 要追加的新值。
   * @param {boolean} replace - 是否替换现有值。
   */
  append(collectionIndex, newValues, replace) {
    const index = parseInt(collectionIndex);
    if (typeof index !== "number" || isNaN(index) || !this.collection[index]) {
      throw new Error(
        `Invalid collectionIndex: ${collectionIndex}`
      );
    }
    const collection = this.collection[index];
    this._append(collection, newValues, replace);
  }

  /**
   * 向当前活动的集合追加值。
   * @param {Array} newValues - 要追加的新值。
   * @param {boolean} replace - 是否替换现有值。
   */
  appendCurrent(newValues, replace) {
    if (this.isActive && this.current.collection) {
      this._append(this.current.collection, newValues, replace);
    } else {
      throw new Error(
        "No active state or collection. Please use append instead and pass an index."
      );
    }
  }

  /**
   * 从一个或多个 DOM 元素分离 Tribute。
   * @param {Element|NodeList|Array|jQuery} el - 要分离的 DOM 元素。
   */
  detach(el) {
    if (!el) {
      throw new Error("[Tribute] Must pass in a DOM node or NodeList.");
    }

    if (typeof jQuery !== "undefined" && el instanceof jQuery) {
      el = el.get();
    }

    if (
      el.constructor === NodeList ||
      el.constructor === HTMLCollection ||
      el.constructor === Array
    ) {
      const length = el.length;
      for (let i = 0; i < length; ++i) {
        this._detach(el[i]);
      }
    } else {
      this._detach(el);
    }
  }

  /**
   * 从单个 DOM 元素分离 Tribute。
   * @param {Element} el - 要分离的 DOM 元素。
   * @private
   */
  _detach(el) {
    this.events.unbind(el); // 使用 TributeEvents 解绑

    if (el.tributeMenu) {
      this.menuEvents.unbind(el.tributeMenu); // 使用 TributeMenuEvents 解绑
      if (this.menu && typeof this.menu.destroy === 'function') {
        this.menu.destroy(); // 调用TributeMenu实例的销毁方法
      }
      delete el.tributeMenu;
    }

    el.removeAttribute("data-tribute");

    // 如果这是最后一个分离的元素，并且没有其他活动的Tribute实例共享此菜单，
    // 则可以考虑完全销毁菜单DOM。
    // 但当前设计是每个Tribute实例一个TributeMenu实例，
    // TributeMenu的destroy方法会处理其DOM。
    // 如果isActive为true，且这是当前元素，则隐藏菜单
    if (this.isActive && this.current.element === el) {
        this.hideMenu();
    }
  }

  /**
   * (多选模式) 切换指定项目的勾选状态。
   * @param {string | number} itemId - 项目的唯一标识符 (通常是 fillAttr 的值或索引)。
   * @param {boolean}isSelected - 项目是否被勾选。
   * @param {object} itemOriginal - 原始项目数据 (可选，如果需要存储整个对象)。
   */
  toggleItemSelected(itemId, isSelected, itemOriginal) {
    if (!this.current.collection || !this.current.collection.multipleSelectMode) {
      return;
    }
    // itemOriginal 通常在 TributeMenu 中渲染时可以从 matchItem.original 获取
    // 这里假设如果提供了 itemOriginal，就存储它，否则可能只存储ID（取决于需求）
    // 为了简单起见，并且能在确认时获取到完整信息，我们存储 itemOriginal (如果可用)
    // 或者至少是能从 filteredItems 中重新找到它的信息。
    // TributeMenu 中的 checkbox 事件处理器应传递 item.original。

    const itemToStore = itemOriginal || this.current.filteredItems.find(fi => (fi.original[this.current.collection.fillAttr] || fi.index) == itemId)?.original;


    if (isSelected) {
      if (itemToStore) {
        this.selectedItems.set(itemId.toString(), itemToStore);
      }
    } else {
      this.selectedItems.delete(itemId.toString());
    }
    // console.log("Selected items:", this.selectedItems);
  }

  /**
   * (多选模式) 清空所有已勾选的项目。
   */
  clearSelectedItems() {
    if (this.current.collection && this.current.collection.multipleSelectMode) {
      this.selectedItems.clear();
      // 可能需要通知菜单更新勾选框状态，但这通常在重新渲染或特定UI更新逻辑中处理
      // 例如，在点击取消按钮后，菜单会关闭并重置。
      // 如果菜单保持打开，则需要一个机制来取消所有勾选框的选中状态。
      if (this.menu && this.menu.menu) {
        const checkboxes = this.menu.menu.querySelectorAll('.tribute-menu-item-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
      }
    }
  }

  /**
   * (多选模式) 处理确认按钮点击事件。
   * 将所有已勾选的项目填充到输入框。
   */
  confirmMultipleSelection() {
    if (!this.current.collection || !this.current.collection.multipleSelectMode || this.selectedItems.size === 0) {
      // 如果不是多选模式，或者没有选中任何项，则可能直接关闭菜单或不执行任何操作
      this.hideMenu();
      return;
    }

    const itemsToInsert = Array.from(this.selectedItems.values());
    let combinedContent = "";

    // 生成每个选中项的内容并拼接
    // 考虑拼接方式：目前简单地用空格拼接，未来可以考虑配置分隔符
    itemsToInsert.forEach((originalItem, index) => {
      // 为了调用 selectTemplate，我们需要构造一个 TributeItem 结构
      // selectTemplate 的参数是 TributeItem<T> | undefined
      // 我们需要找到原始 item 在 filteredItems 中的对应项以获取 score 和 string (高亮后的)
      // 但 selectTemplate 主要依赖 original 和 fillAttr，所以我们可以简化构造
      // 或者，如果 selectTemplate 只用 original，我们可以直接传递。
      // 为确保兼容性，我们尝试构造一个基本的 TributeItem 结构。
      // 注意：这里的 `string` 和 `score` 可能不是最精确的，因为它们来自原始数据，
      // 而不是搜索结果。但对于 `defaultSelectTemplate` 来说，它主要使用 `original` 和 `fillAttr`。
      const tempTributeItem = {
        original: originalItem,
        score: 0, // 模拟一个分数
        string: originalItem[this.current.collection.lookup] || '', // 模拟高亮字符串
        index: -1 // 索引在这里可能不重要
      };

      let contentPart = this.current.collection.selectTemplate.call(this.config, tempTributeItem);

      // 移除 selectTemplate 可能添加的默认触发字符和末尾的空格/&nbsp; (如果它是为单选设计的)
      // 这是一个启发式处理，可能需要更健壮的方案或让用户提供专门的多选selectTemplate
      if (contentPart.startsWith(this.current.collection.trigger)) {
          contentPart = contentPart.substring(this.current.collection.trigger.length);
      }
      // 移除末尾的单个空格或 &nbsp;
      contentPart = contentPart.replace(/(\s|\&nbsp\;)$/, "");


      combinedContent += contentPart;
      if (index < itemsToInsert.length - 1) {
        combinedContent += ", "; // 用逗号和空格分隔多个选中项
      }
    });

    if (combinedContent) {
      // 触发字符 + 组合内容 + 后缀
      const fullContentToInsert = this.current.collection.trigger + combinedContent;
      this.replaceText(fullContentToInsert, new Event('submit'), itemsToInsert); // originalEvent 和 item 可能需要调整
    }

    const timeout = this.current.collection.delayCloseMenuTimeout || 0;
    setTimeout(() => {
      this.hideMenu();
      this.clearSelectedItems();
    }, timeout);
  }

  /**
   * (多选模式) 处理取消按钮点击事件。
   * 清空已勾选项并关闭菜单。
   */
  cancelMultipleSelection() {
    const timeout = (this.current.collection && this.current.collection.delayCloseMenuTimeout)
                    ? this.current.collection.delayCloseMenuTimeout
                    : 0;
    setTimeout(() => {
      this.hideMenu();
      this.clearSelectedItems();
    }, timeout);
  }
}

export default Tribute;
