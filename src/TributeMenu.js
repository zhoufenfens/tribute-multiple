// src/TributeMenu.js
import TributeRange from "./TributeRange";
import TributeConfig from "./TributeConfig"; // 需要访问 TributeConfig.defaultMenuItemTemplate

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
    this.tribute = tribute;
    this.menu = null;
  }

  /**
   * 创建提及菜单的 DOM 结构。
   * @param {string} containerClass - 应用于菜单容器 <div> 的 CSS 类名。
   * @returns {HTMLElement} - 创建的菜单容器 DOM 元素。
   * @private
   */
  _createMenu(containerClass) {
    const doc = this.tribute.range.getDocument();
    const wrapper = doc.createElement("div");
    const ul = doc.createElement("ul");
    wrapper.className = containerClass;
    wrapper.appendChild(ul);

    if (this.tribute.config.menuContainer) {
      return this.tribute.config.menuContainer.appendChild(wrapper);
    }

    const appendedWrapper = doc.body.appendChild(wrapper);

    // 如果是多选模式 (从 tribute.config 获取全局或集合特定配置)
    // 注意：此时 this.tribute.current.collection 可能尚未设置（如果菜单是首次创建）
    // 因此，我们可能需要依赖一个更通用的方式来检查多选模式是否可能被激活，
    // 或者推迟按钮的创建到 showMenuFor 中，当 current.collection 可用时。
    // 为简单起见，假设在 _createMenu 时，如果 Tribute 实例的某个集合配置了多选，就创建按钮骨架。
    // 按钮的实际显示/隐藏逻辑将在 showMenuFor 中根据具体情况处理。
    // 修改：按钮的创建应该更可靠地基于全局配置，因为 current.collection 在菜单首次创建时可能未定义。
    // 一个通用的做法是检查 this.tribute.collection 中是否有任何一个配置启用了多选，
    // 或者更简单地，如果全局的 multipleSelectMode （如果存在这样的顶层配置）或第一个集合的配置是多选，则创建。
    // 此处我们依赖于 showMenuFor 时 current.collection 会被正确设置。
    // 因此，按钮的创建和事件绑定可以保留，但文本和显隐在showMenuFor中更新。

    // 查找是否有任何集合配置启用了多选模式
    const anyCollectionIsMultiSelect = this.tribute.collection.some(c => c.multipleSelectMode);

    if (anyCollectionIsMultiSelect) {
        const buttonsContainer = doc.createElement("div");
        buttonsContainer.className = "tribute-menu-buttons";
        buttonsContainer.style.display = "none"; // 初始隐藏

        const confirmButton = doc.createElement("button");
        confirmButton.className = "tribute-menu-button tribute-menu-confirm-button";
        // 默认文本，将在 showMenuFor 中更新
        confirmButton.textContent = "确定";
        confirmButton.addEventListener("click", () => this.tribute.confirmMultipleSelection());

        const cancelButton = doc.createElement("button");
        cancelButton.className = "tribute-menu-button tribute-menu-cancel-button";
        cancelButton.textContent = "取消"; // 默认文本
        cancelButton.addEventListener("click", () => this.tribute.cancelMultipleSelection());

        buttonsContainer.appendChild(confirmButton);
        buttonsContainer.appendChild(cancelButton);
        appendedWrapper.appendChild(buttonsContainer);
    }
    return appendedWrapper;
  }

  /**
   * 为指定的输入元素显示提及菜单。
   * @param {HTMLElement} element - 触发提及的输入元素。
   * @param {boolean} scrollTo - 是否滚动到菜单位置。
   */
  showMenuFor(element, scrollTo) {
    const current = this.tribute.current;
    const collection = current.collection;

    if (
      this.tribute.isActive &&
      this.menu &&
      current.element === element &&
      this.tribute.currentMentionTextSnapshot === current.mentionText
    ) {
      return;
    }
    this.tribute.currentMentionTextSnapshot = current.mentionText;

    if (!this.menu) {
      this.menu = this._createMenu(collection.containerClass);
      element.tributeMenu = this.menu;
    }

    const isInitialMultiSelectUIActive = collection.multipleSelectMode && (!current.mentionText || current.mentionText.length === 0);

    const buttonsContainer = this.menu.querySelector(".tribute-menu-buttons");
    if (buttonsContainer) {
      buttonsContainer.style.display = isInitialMultiSelectUIActive ? "block" : "none";
      // 更新按钮文本，以防 collection 切换
      buttonsContainer.querySelector(".tribute-menu-confirm-button").textContent = collection.confirmBtnText || "确定";
      buttonsContainer.querySelector(".tribute-menu-cancel-button").textContent = collection.cancelBtnText || "取消";
    }

    this.tribute.isActive = true;
    this.tribute.menuSelected = 0;

    if (!current.mentionText) {
      current.mentionText = "";
    }

    const processValues = (values) => {
      if (!this.tribute.isActive) {
        return;
      }

      let items = this.tribute.search.filter(current.mentionText, values, {
        pre: collection.searchOpts.pre || "<span>",
        post: collection.searchOpts.post || "</span>",
        skip: collection.searchOpts.skip,
        extract: (el) => {
          if (typeof collection.lookup === "string") {
            return el[collection.lookup];
          } else if (typeof collection.lookup === "function") {
            return collection.lookup(el, current.mentionText);
          } else {
            throw new Error(
              "[Tribute]无效的 `lookup` 配置：必须是字符串或函数。"
            );
          }
        },
      });

      if (collection.menuItemLimit) {
        items = items.slice(0, collection.menuItemLimit);
      }

      this.tribute.current.filteredItems = items;
      const ul = this.menu.querySelector("ul");

      if (!items.length) {
        const noMatchEvent = new CustomEvent("tribute-no-match", { detail: this.menu });
        current.element.dispatchEvent(noMatchEvent);

        const noMatchTemplate = current.collection.noMatchTemplate;
        let noMatchContent = null;

        if (typeof noMatchTemplate === "function") {
          noMatchContent = noMatchTemplate.call(this.tribute);
        } else if (typeof noMatchTemplate === "string") {
          noMatchContent = noMatchTemplate;
        }

        if (!noMatchContent) {
          this.hideMenu();
        } else {
          ul.innerHTML = noMatchContent;
          this.tribute.range.positionMenuAtCaret(scrollTo);
        }
        return;
      }

      ul.innerHTML = "";
      const fragment = this.tribute.range.getDocument().createDocumentFragment();

      items.forEach((item, index) => {
        const li = this.tribute.range.getDocument().createElement("li");
        li.setAttribute("data-index", index);
        li.className = collection.itemClass;

        li.addEventListener("mousemove", (e) => {
          let [_liTarget, idxStr] = this._findLiTarget(e.target);
          if (idxStr && e.movementY !== 0) {
             this.tribute.setActiveLi(parseInt(idxStr, 10));
          }
        });

        if (this.tribute.menuSelected === index && !collection.multipleSelectMode) {
          li.classList.add(collection.selectClass);
        }

        if (typeof collection.menuItemTemplate === 'function') {
            if (collection.menuItemTemplate === TributeConfig.defaultMenuItemTemplate) {
                li.innerHTML = collection.menuItemTemplate.call(this.tribute.config, item);
            } else {
                li.innerHTML = collection.menuItemTemplate.call(this.tribute, item);
            }
        } else {
            li.innerHTML = item.string;
        }

        const checkbox = li.querySelector('.tribute-menu-item-checkbox');
        if (checkbox) {
            checkbox.style.display = isInitialMultiSelectUIActive ? "" : "none";
            if (isInitialMultiSelectUIActive) {
                const itemId = checkbox.getAttribute('data-id');
                if (this.tribute.selectedItems && this.tribute.selectedItems.has(itemId.toString())) {
                    checkbox.checked = true;
                } else {
                    checkbox.checked = false;
                }
                if (!checkbox.hasAttribute('data-tribute-event-bound')) {
                    checkbox.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.tribute.toggleItemSelected(itemId, checkbox.checked, item.original);
                    });
                    checkbox.setAttribute('data-tribute-event-bound', 'true');
                }
            }
        }
        fragment.appendChild(li);
      });
      ul.appendChild(fragment);

      this.tribute.range.positionMenuAtCaret(scrollTo);
    };

    if (typeof collection.values === "function") {
      if (collection.loadingItemTemplate) {
        this.menu.querySelector("ul").innerHTML = collection.loadingItemTemplate;
        this.tribute.range.positionMenuAtCaret(scrollTo);
      }
      collection.values(current.mentionText, processValues);
    } else {
      processValues(collection.values);
    }
  }

  /**
   * 从事件目标（或其父节点）中查找对应的 <li> 菜单项及其 `data-index` 属性。
   * @param {HTMLElement} el - 鼠标事件的原始目标 DOM 元素。
   * @returns {Array<HTMLElement|null, string|null>}
   * @private
   */
  _findLiTarget(el) {
    if (!el) return [null, null];
    let currentEl = el;
    const menuUl = this.menu ? this.menu.querySelector('ul') : null;
    if (!menuUl) return [null, null];

    while (currentEl && currentEl !== document.body && currentEl !== this.menu) {
      if (currentEl.nodeName.toLowerCase() === "li" && currentEl.parentNode === menuUl && currentEl.hasAttribute("data-index")) {
        return [currentEl, currentEl.getAttribute("data-index")];
      }
      currentEl = currentEl.parentNode;
    }
    return [null, null];
  }

  /**
   * 隐藏提及菜单。
   */
  hideMenu() {
    if (this.menu) {
      this.menu.style.cssText = "display: none;";
      this.tribute.isActive = false;
      this.tribute.menuSelected = 0;
    }
  }

  /**
   * 根据索引选择菜单中的一个项目。
   * @param {number | string} index - 要选择的项目的索引。
   * @param {Event} originalEvent - 触发选择的原始 DOM 事件。
   */
  selectItemAtIndex(index, originalEvent) {
    const parsedIndex = parseInt(index, 10);
    if (typeof parsedIndex !== "number" || isNaN(parsedIndex)) return;

    const current = this.tribute.current;
    if (!current || !current.filteredItems || !current.collection) return;

    const item = current.filteredItems[parsedIndex];
    if (!item) return;

    const mentionText = current.mentionText;
    const isInitialMultiSelectUIActive = current.collection.multipleSelectMode && (!mentionText || mentionText.length === 0);

    if (isInitialMultiSelectUIActive) {
      // 在多选模式的初始列表状态下，此方法（主要由键盘导航触发）应切换勾选状态
      const liTarget = this.menu.querySelector(`ul > li[data-index="${parsedIndex}"]`);
      if (liTarget) {
          const checkbox = liTarget.querySelector('.tribute-menu-item-checkbox');
          if (checkbox && checkbox.style.display !== 'none') {
              checkbox.checked = !checkbox.checked;
              const itemId = checkbox.dataset.id;
              this.tribute.toggleItemSelected(itemId, checkbox.checked, item.original);
          }
      }
      return;
    }

    // 单选模式逻辑, 或多选模式下的搜索过滤后的单选行为
    const content = current.collection.selectTemplate.call(this.tribute.config, item);

    if (content !== null) {
      this.tribute.replaceText(content, originalEvent, item);
    }
    this.hideMenu();
  }

  /**
   * 销毁菜单。
   */
  destroy() {
    if (this.menu) {
      if (this.menu.parentNode) {
        this.menu.parentNode.removeChild(this.menu);
      }
      this.menu = null;
    }
  }
}

export default TributeMenu;
