// src/TributeMenu.js
import TributeRange from "./TributeRange"; // 假设 TributeRange 仍然处理定位逻辑，或已进一步拆分

/**
 * @class TributeMenu
 * @classdesc 管理提及菜单的创建、显示、内容填充、隐藏以及项目选择逻辑。
 *            它与 Tribute 主类紧密协作，响应用户输入和交互。
 */
class TributeMenu {
  /**
   * TributeMenu 构造函数。
   * @param {Tribute} tribute - Tribute 主实例的引用。TributeMenu 通过此引用
   *                            访问配置 (tribute.config)、当前状态 (tribute.current)、
   *                            搜索模块 (tribute.search) 和范围/定位工具 (tribute.range)。
   */
  constructor(tribute) {
    this.tribute = tribute; // 对主 Tribute 实例的引用
    this.menu = null;       // 将持有菜单的 DOM 元素 (通常是一个 div 包含一个 ul)
    // this.tributeRange = new TributeRange(tribute); // TributeRange 实例现在由主 Tribute 类创建和管理 (this.tribute.range)
                                                 // 这里不再需要单独创建 TributeRange 的新实例。
                                                 // 所有与范围和定位相关的操作都应通过 this.tribute.range 调用。
  }

  /**
   * 创建提及菜单的 DOM 结构。
   * 菜单是一个包含 <ul> 列表的 <div> 容器。
   * 它会被附加到 `tribute.config.menuContainer` (如果提供) 或 `document.body`。
   * @param {string} containerClass - 应用于菜单容器 <div> 的 CSS 类名。
   * @returns {HTMLElement} - 创建的菜单容器 DOM 元素。
   * @private
   */
  _createMenu(containerClass) {
    const doc = this.tribute.range.getDocument(); // 获取正确的 document 对象 (可能在 iframe 内)
    const wrapper = doc.createElement("div"); // 菜单的最外层容器
    const ul = doc.createElement("ul");          // 无序列表，用于存放菜单项
    wrapper.className = containerClass;          // 设置容器的 CSS 类
    wrapper.appendChild(ul);                     // 将列表添加到容器中

    // 如果用户配置了 menuContainer，则将菜单附加到该容器
    if (this.tribute.config.menuContainer) {
      return this.tribute.config.menuContainer.appendChild(wrapper);
    }

    // 否则，默认附加到文档的 body
    const appendedWrapper = doc.body.appendChild(wrapper);

    // 如果是多选模式，添加确认和取消按钮
    if (this.tribute.current && this.tribute.current.collection && this.tribute.current.collection.multipleSelectMode) {
        const buttonsContainer = doc.createElement("div");
        buttonsContainer.className = "tribute-menu-buttons";

        const confirmButton = doc.createElement("button");
        confirmButton.className = "tribute-menu-button tribute-menu-confirm-button";
        confirmButton.textContent = this.tribute.current.collection.confirmBtnText || "确定";
        confirmButton.addEventListener("click", () => this.tribute.confirmMultipleSelection());

        const cancelButton = doc.createElement("button");
        cancelButton.className = "tribute-menu-button tribute-menu-cancel-button";
        cancelButton.textContent = this.tribute.current.collection.cancelBtnText || "取消";
        cancelButton.addEventListener("click", () => this.tribute.cancelMultipleSelection());

        buttonsContainer.appendChild(confirmButton);
        buttonsContainer.appendChild(cancelButton);
        appendedWrapper.appendChild(buttonsContainer); // 将按钮容器添加到菜单外部包装器
    }

    return appendedWrapper;
  }

  /**
   * 为指定的输入元素显示提及菜单。
   * 此方法负责处理菜单的显示逻辑，包括：
   * - 检查是否需要更新菜单（基于活动状态和提及文本的变化）。
   * - 如果菜单 DOM 不存在，则创建它。
   * - 更新 Tribute 的内部状态 (isActive, menuSelected)。
   * - 调用搜索模块过滤数据，并用结果填充菜单项。
   * - 处理无匹配项或加载状态的显示。
   * - 定位菜单到光标附近。
   * @param {HTMLElement} element - 触发提及的输入元素 (input, textarea, 或 contentEditable)。
   * @param {boolean} scrollTo - 是否在定位菜单后尝试将其滚动到视图中。
   */
  showMenuFor(element, scrollTo) {
    const current = this.tribute.current; // 当前 Tribute 状态 (element, collection, mentionText 等)
    const collection = current.collection;   // 当前活动的集合配置

    // 优化：如果菜单已激活，且是针对同一元素和相同的提及文本，则不重新渲染
    if (
      this.tribute.isActive &&
      this.menu && // 确保 this.menu 已被创建
      current.element === element &&
      this.tribute.currentMentionTextSnapshot === current.mentionText // 快照用于检测文本变化
    ) {
      return; // 无需操作
    }
    // 更新提及文本快照，用于下次比较
    this.tribute.currentMentionTextSnapshot = current.mentionText;

    // 如果菜单 DOM 元素 (this.menu) 尚未创建，则调用 _createMenu
    if (!this.menu) {
      this.menu = this._createMenu(collection.containerClass); // 使用当前集合的 containerClass
      element.tributeMenu = this.menu; // 在触发元素上存储对菜单的引用 (可选，但有时有用)

      // 注意: 菜单事件 (如点击菜单项) 的绑定现在由 TributeMenuEvents 类处理。
      // Tribute 主类会在适当的时候调用 menuEvents.bind(this.menu)。
    }

    // 更新 Tribute 状态
    this.tribute.isActive = true;     // 标记菜单为活动状态
    this.tribute.menuSelected = 0;    // 重置选中项索引为第一个 (0)

    // 确保 current.mentionText 有一个值 (至少是空字符串)
    if (!current.mentionText) {
      current.mentionText = "";
    }

    // 定义处理搜索结果并更新菜单的回调函数
    const processValues = (values) => {
      // 再次检查：在异步获取数据后，Tribute 可能已经不再活动
      if (!this.tribute.isActive) {
        return;
      }

      // 使用 tribute.search 模块过滤数据
      // `values` 是从 collection.values (可能是函数或数组) 获取到的原始数据列表
      // `current.mentionText` 是用户已输入的查询文本
      let items = this.tribute.search.filter(current.mentionText, values, {
        pre: collection.searchOpts.pre || "<span>", // 高亮前缀
        post: collection.searchOpts.post || "</span>", // 高亮后缀
        skip: collection.searchOpts.skip, // 是否跳过某些项的搜索逻辑
        extract: (el) => { // 从数据项中提取用于搜索的字符串
          if (typeof collection.lookup === "string") {
            return el[collection.lookup]; // 按属性名查找
          } else if (typeof collection.lookup === "function") {
            return collection.lookup(el, current.mentionText); // 使用自定义查找函数
          } else {
            throw new Error(
              "[Tribute]无效的 `lookup` 配置：必须是字符串或函数。"
            );
          }
        },
      });

      // 如果配置了菜单项数量限制，则截断结果
      if (collection.menuItemLimit) {
        items = items.slice(0, collection.menuItemLimit);
      }

      // 存储过滤后的项目列表到当前状态
      this.tribute.current.filteredItems = items;
      const ul = this.menu.querySelector("ul"); // 获取菜单中的 <ul> 元素

      // 处理没有匹配项的情况
      if (!items.length) {
        // 触发 "tribute-no-match" 自定义事件
        const noMatchEvent = new CustomEvent("tribute-no-match", { detail: this.menu });
        current.element.dispatchEvent(noMatchEvent);

        const noMatchTemplate = current.collection.noMatchTemplate; // 获取无匹配模板
        let noMatchContent = null;

        // 根据模板类型（函数或字符串）获取内容
        if (typeof noMatchTemplate === "function") {
          noMatchContent = noMatchTemplate.call(this.tribute); // 确保函数内 this 指向 Tribute 实例
        } else if (typeof noMatchTemplate === "string") {
          noMatchContent = noMatchTemplate;
        }

        // 如果没有有效的无匹配模板内容，则隐藏菜单；否则显示模板内容
        if (!noMatchContent) {
          this.hideMenu();
        } else {
          ul.innerHTML = noMatchContent; // 将模板内容填充到 <ul>
          this.tribute.range.positionMenuAtCaret(scrollTo); // 定位菜单
        }
        return; // 无匹配项，处理完毕
      }

      // 清空现有的菜单项
      ul.innerHTML = "";
      const fragment = this.tribute.range.getDocument().createDocumentFragment(); // 使用文档片段提高性能

      // 遍历过滤后的项目，为每个项目创建 <li> 元素
      items.forEach((item, index) => {
        const li = this.tribute.range.getDocument().createElement("li");
        li.setAttribute("data-index", index); // 存储索引，用于后续选择
        li.className = collection.itemClass;   // 应用自定义的菜单项 CSS 类

        // 鼠标悬停事件，用于高亮菜单项
        // 注意: 此处的 mousemove 事件处理现在应该由 Tribute 主类或 TributeEvents/TributeMenuEvents 处理，
        // 以便集中管理事件和状态更新 (如 this.tribute.menuSelected 和高亮类)。
        // 这里保留是为了说明原始逻辑，但在重构版本中，这种直接的 DOM 事件绑定和状态操作
        // 应该通过 Tribute 实例的方法 (如 tribute.setActiveLi(index)) 来进行。
        li.addEventListener("mousemove", (e) => {
          let [_liTarget, idxStr] = this._findLiTarget(e.target); // 找到目标 <li> 及其索引
          if (idxStr && e.movementY !== 0) { // Y轴有移动才触发，避免不必要的更新
             this.tribute.setActiveLi(parseInt(idxStr, 10)); // 更新 Tribute 中的选中项
          }
        });

        // 如果当前项是预选中的项，添加选中状态的 CSS 类
        if (this.tribute.menuSelected === index && !collection.multipleSelectMode) { // 多选模式下，高亮可能由勾选状态决定
          li.classList.add(collection.selectClass);
        }

        // 使用 menuItemTemplate 生成 <li> 的内容
        // 确保 menuItemTemplate 函数的 `this` 上下文正确
        // 对于 defaultMenuItemTemplate，它现在需要 TributeConfig 的上下文来访问 tributeInstance
        if (typeof collection.menuItemTemplate === 'function') {
            if (collection.menuItemTemplate === TributeConfig.defaultMenuItemTemplate) {
                li.innerHTML = collection.menuItemTemplate.call(this.tribute.config, item);
            } else {
                // 用户自定义的模板，通常期望 this 指向 Tribute 实例
                li.innerHTML = collection.menuItemTemplate.call(this.tribute, item);
            }
        } else {
            li.innerHTML = item.string;
        }

        // 如果是多选模式，处理勾选框的初始状态
        if (collection.multipleSelectMode) {
            const checkbox = li.querySelector('.tribute-menu-item-checkbox');
            if (checkbox) {
                const itemId = checkbox.getAttribute('data-id');
                // 假设 this.tribute.selectedItems 是一个 Set 或 Array 存储已选项的 id
                if (this.tribute.selectedItems && this.tribute.selectedItems.has(itemId.toString())) {
                    checkbox.checked = true;
                }
                // 勾选框的点击事件监听器，用于更新 selectedItems
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation(); // 防止触发 li 的点击事件（如果li也有事件）
                    // 当点击 checkbox 时，传递原始项目数据给 toggleItemSelected
                    this.tribute.toggleItemSelected(itemId, checkbox.checked, item.original);
                });
            }
        }
        fragment.appendChild(li); // 将创建的 <li> 添加到文档片段
      });
      ul.appendChild(fragment); // 将所有菜单项一次性添加到 <ul>

      this.tribute.range.positionMenuAtCaret(scrollTo); // 定位菜单
    };

    // 根据 collection.values 的类型（函数或数组）获取数据
    if (typeof collection.values === "function") {
      // 如果 values 是函数 (异步获取数据)
      if (collection.loadingItemTemplate) {
        // 如果有加载状态模板，先显示它
        this.menu.querySelector("ul").innerHTML = collection.loadingItemTemplate;
        this.tribute.range.positionMenuAtCaret(scrollTo); // 定位加载状态的菜单
      }
      // 调用函数获取数据，传入当前提及文本和处理回调
      collection.values(current.mentionText, processValues);
    } else {
      // 如果 values 是数组 (同步数据)
      processValues(collection.values);
    }
  }

  /**
   * 从事件目标（或其父节点）中查找对应的 <li> 菜单项及其 `data-index` 属性。
   * 用于鼠标事件处理，确定用户悬停或点击的是哪个菜单项。
   * @param {HTMLElement} el - 鼠标事件的原始目标 DOM 元素。
   * @returns {Array<HTMLElement|null, string|null>} - 返回一个数组，第一个元素是找到的 <li> (或null)，
   *                                                    第二个元素是 `data-index` 的值 (或null)。
   * @private
   */
  _findLiTarget(el) {
    if (!el) return [null, null]; // 如果目标元素为空，直接返回
    let currentEl = el;
    // 向上遍历 DOM 树，直到找到一个带有 `data-index` 属性的 <li> 元素，
    // 或者到达菜单的 <ul> 容器的父级（即菜单 div 本身）或 document body。
    // 这个循环确保我们只在菜单项内部查找。
    const menuUl = this.menu ? this.menu.querySelector('ul') : null;
    if (!menuUl) return [null, null]; // 如果菜单或ul不存在，无法查找

    while (currentEl && currentEl !== document.body && currentEl !== this.menu) {
      if (currentEl.nodeName.toLowerCase() === "li" && currentEl.parentNode === menuUl && currentEl.hasAttribute("data-index")) {
        return [currentEl, currentEl.getAttribute("data-index")]; // 找到了，返回 <li> 和索引
      }
      currentEl = currentEl.parentNode; // 继续向上查找
    }
    return [null, null]; // 未找到符合条件的 <li>
  }

  /**
   * 隐藏提及菜单。
   * 同时重置 Tribute 的激活状态和选中项索引。
   * 注意：Tribute 主类中的 `hideMenu` 方法会调用此方法，并可能执行额外的状态清理。
   */
  hideMenu() {
    if (this.menu) {
      this.menu.style.cssText = "display: none;"; // 通过 CSS 隐藏菜单
      this.tribute.isActive = false;             // 更新 Tribute 状态
      this.tribute.menuSelected = 0;           // 重置选中项
      // this.tribute.current = {}; // 清理当前状态的职责通常在 Tribute 主类的 hideMenu 方法中
    }
  }

  /**
   * 根据索引选择菜单中的一个项目。
   * 当用户通过键盘（回车/Tab）或鼠标点击选择项目时调用。
   * @param {number | string} index - 要选择的项目的索引（通常来自 `data-index` 属性）。
   * @param {Event} originalEvent - 触发选择的原始 DOM 事件 (例如键盘事件或鼠标事件)。
   */
  selectItemAtIndex(index, originalEvent) {
    const parsedIndex = parseInt(index, 10); // 将索引转换为数字
    // 验证索引是否有效
    if (typeof parsedIndex !== "number" || isNaN(parsedIndex)) return;

    const current = this.tribute.current;
    // 确保当前状态、过滤后的项目列表和集合配置都存在
    if (!current || !current.filteredItems || !current.collection) return;

    const item = current.filteredItems[parsedIndex]; // 获取选中的项目数据
    if (!item) return; // 如果索引无效或项目不存在，则不执行操作

    // 如果是多选模式，通过索引选择项目的行为可能会不同。
    // 例如，可能只是高亮而不立即插入，或者切换勾选状态（如果键盘导航支持）。
    // 当前的实现是，如果启用了多选，则 selectItemAtIndex 不会直接插入文本，
    // 而是依赖确认按钮。此方法主要用于非多选模式下的直接选择。
    if (current.collection.multipleSelectMode) {
        // 在多选模式下，通过键盘或API调用此方法时，可以考虑切换对应项的勾选状态
        // 并更新视觉高亮，但不立即替换文本或关闭菜单。
        // 例如：
        // const checkbox = this.menu.querySelector(`li[data-index="${parsedIndex}"] .tribute-menu-item-checkbox`);
        // if (checkbox) {
        //   checkbox.checked = !checkbox.checked;
        //   this.tribute.toggleItemSelected(checkbox.dataset.id, checkbox.checked, item.original);
        // }
        // this.tribute.setActiveLi(parsedIndex); // 仅更新高亮
        // 为保持简单，当前多选模式下，此方法不执行任何操作，选择完全由勾选框和确认按钮控制。
        // 如果需要键盘支持多选，这里的逻辑需要扩展。
        return;
    }

    // --- 以下为单选模式逻辑 ---
    // 使用当前集合的 selectTemplate 生成要插入的文本/HTML
    const content = current.collection.selectTemplate.call(this.tribute.config, item);

    // 如果模板返回了有效内容，则替换文本并隐藏菜单
    if (content !== null) { // 模板可以返回 null 来阻止替换
      this.tribute.replaceText(content, originalEvent, item); // 调用主类的替换文本方法
    }
    this.hideMenu(); // 选择后隐藏菜单
  }

  /**
   * 销毁菜单。
   * 从 DOM 中移除菜单元素，并进行必要的清理。
   * 主要在 Tribute 实例被 detach 时调用。
   */
  destroy() {
    if (this.menu) {
      // 在移除 DOM 元素前，理论上应该先解绑附加到此菜单元素上的所有事件监听器。
      // 这个职责现在由 TributeMenuEvents.unbind(this.menu) 处理，
      // Tribute 主类的 _detach 方法会调用它。

      // 从 DOM 中移除菜单
      if (this.menu.parentNode) {
        this.menu.parentNode.removeChild(this.menu);
      }
      this.menu = null; // 清除对 DOM 元素的引用
    }
  }
}

export default TributeMenu;
