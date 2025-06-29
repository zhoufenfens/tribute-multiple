// src/TributeEvents.js

/**
 * @class TributeEvents
 * @classdesc 处理附加到输入元素（input, textarea, contentEditable）的事件。
 */
class TributeEvents {
  /**
   * 构造函数
   * @param {Tribute} tribute - Tribute 主实例的引用。
   */
  constructor(tribute) {
    this.tribute = tribute;
    // this.tribute.events = this; // 主实例中已设置 this.events = new TributeEvents(this)
  }

  /**
   * 定义需要特殊处理的键盘按键。
   * @returns {Array<object>} - 按键码和对应值的数组。
   * @static
   */
  static keys() {
    return [
      { key: 9, value: "TAB" },
      { key: 8, value: "DELETE" },
      { key: 13, value: "ENTER" },
      { key: 27, value: "ESCAPE" },
      { key: 32, value: "SPACE" },
      { key: 38, value: "UP" },
      { key: 40, value: "DOWN" },
    ];
  }

  /**
   * 将事件监听器绑定到指定的 DOM 元素。
   * @param {HTMLElement} element - 要绑定事件的 DOM 元素。
   */
  bind(element) {
    // 使用 .call(element, this.tribute, ...) 来确保事件处理函数中的 `this` 指向 `element`
    // 并将 `tributeInstance` 作为第一个参数传递。
    element.boundKeydown = (event) => this.keydown.call(element, this.tribute, event);
    element.boundKeyup = (event) => this.keyup.call(element, this.tribute, event);
    element.boundInput = (event) => this.input.call(element, this.tribute, event);

    element.addEventListener("keydown", element.boundKeydown, true);
    element.addEventListener("keyup", element.boundKeyup, true);
    element.addEventListener("input", element.boundInput, true);
  }

  /**
   * 从指定的 DOM 元素解绑事件监听器。
   * @param {HTMLElement} element - 要解绑事件的 DOM 元素。
   */
  unbind(element) {
    element.removeEventListener("keydown", element.boundKeydown, true);
    element.removeEventListener("keyup", element.boundKeyup, true);
    element.removeEventListener("input", element.boundInput, true);

    delete element.boundKeydown;
    delete element.boundKeyup;
    delete element.boundInput;
  }

  /**
   * 处理 keydown 事件。
   * `this` 在这里指向 `element`。
   * @param {Tribute} tributeInstance - Tribute 主实例的引用。
   * @param {KeyboardEvent} event - 键盘事件对象。
   */
  keydown(tributeInstance, event) {
    if (this.shouldDeactivate(tributeInstance, event)) {
      tributeInstance.isActive = false;
      tributeInstance.hideMenu();
    }

    const element = this; // `this` is the element
    tributeInstance.commandEvent = false;

    TributeEvents.keys().forEach((o) => {
      if (o.key === event.keyCode) {
        tributeInstance.commandEvent = true;
        // 调用 callbacks 时，确保上下文和参数正确
        this.callbacks(tributeInstance)[o.value.toLowerCase()](event, element);
      }
    });
  }

  /**
   * 处理 input 事件。
   * `this` 在这里指向 `element`。
   * @param {Tribute} tributeInstance - Tribute 主实例的引用。
   * @param {InputEvent} event - 输入事件对象。
   */
  input(tributeInstance, event) {
    tributeInstance.inputEvent = true;
    // keyup 也需要正确的 `this` (element) 和 tributeInstance
    this.keyup.call(this, tributeInstance, event);
  }

  // click 事件已移至 TributeMenuEvents.js，因为它主要与菜单交互相关。
  // 如果将来需要在输入元素上处理特定的点击事件（非菜单点击），可以在这里重新添加。

  /**
   * 处理 keyup 事件。
   * `this` 在这里指向 `element`。
   * @param {Tribute} tributeInstance - Tribute 主实例的引用。
   * @param {KeyboardEvent | InputEvent} event - 事件对象。
   */
  keyup(tributeInstance, event) {
    if (tributeInstance.inputEvent) {
      tributeInstance.inputEvent = false;
    }
    this.updateSelection(tributeInstance, this); // `this` is the element

    if (event.keyCode === 27) { // ESCAPE key
        if (tributeInstance.isActive) {
            // this.callbacks(tributeInstance).escape(event, this); // Call escape callback
        }
        return;
    }
    // 移除了 `!event.keyCode` 的检查，因为 input 事件可能没有 keyCode

    if (!tributeInstance.allowSpaces && tributeInstance.hasTrailingSpace) {
      tributeInstance.hasTrailingSpace = false;
      tributeInstance.commandEvent = true;
      this.callbacks(tributeInstance)["space"](event, this); // `this` is the element
      return;
    }

    if (!tributeInstance.isActive) {
      if (tributeInstance.autocompleteMode) {
        // 对于自动完成模式，可能总是尝试显示菜单或根据内容触发
        this.callbacks(tributeInstance).triggerChar(event, this, ""); // `this` is the element
      } else {
        const keyCode = this.getKeyCode(tributeInstance, this, event); // `this` is the element

        if (isNaN(keyCode) || !keyCode) return;

        const trigger = tributeInstance.triggers().find((tr) => {
          return tr.charCodeAt(0) === keyCode;
        });

        if (typeof trigger !== "undefined") {
          this.callbacks(tributeInstance).triggerChar(event, this, trigger); // `this` is the element
        }
      }
    }

    // 确保 current 和 collection 存在
    if (!tributeInstance.current || !tributeInstance.current.collection) {
        // 可能在 hideMenu 后 current 被清空，此时不应继续尝试显示菜单
        return;
    }

    if (
      tributeInstance.current.mentionText && // 确保 mentionText 存在
      tributeInstance.current.mentionText.length <
      tributeInstance.current.collection.menuShowMinLength
    ) {
      // 如果菜单当前是活动的，但文本长度不满足要求，则隐藏菜单
      if (tributeInstance.isActive) {
        tributeInstance.hideMenu();
      }
      return;
    }

    // 条件显示菜单
    // (有触发字符 或 自动完成模式) 且 不是命令事件 (如回车、ESC等)
    // 或 菜单已激活 且 按下删除键 (keyCode 8)
    if (
      ((tributeInstance.current.trigger || tributeInstance.autocompleteMode) &&
        tributeInstance.commandEvent === false) ||
      (tributeInstance.isActive && event.keyCode === 8) // DELETE key
    ) {
      tributeInstance.showMenuFor(this, true); // `this` is the element
    }
  }

  /**
   * 判断是否应该停用 Tribute (隐藏菜单)。
   * `this` 指向 `element`。
   * @param {Tribute} tributeInstance - Tribute 主实例的引用。
   * @param {KeyboardEvent} event - 键盘事件对象。
   * @returns {boolean} - 是否应该停用。
   */
  shouldDeactivate(tributeInstance, event) {
    if (!tributeInstance.isActive) return false;

    // 如果提及文本为空，并且按下的不是定义的特殊键，则停用
    if (tributeInstance.current.mentionText && tributeInstance.current.mentionText.length === 0) {
      let eventKeyPressed = false;
      TributeEvents.keys().forEach((o) => {
        if (event.keyCode === o.key) eventKeyPressed = true;
      });
      return !eventKeyPressed;
    }
    return false;
  }

  /**
   * 获取触发字符的 keyCode。
   * `this` 指向 `element`。
   * @param {Tribute} tributeInstance - Tribute 主实例的引用。
   * @param {HTMLElement} el - 当前操作的 DOM 元素 (即 `this`)。
   * @param {Event} event - 事件对象。
   * @returns {number | false} - 触发字符的 keyCode，如果不存在则为 false。
   */
  getKeyCode(tributeInstance, el, event) {
    const info = tributeInstance.range.getTriggerInfo(
      false,
      tributeInstance.hasTrailingSpace,
      true, // requireLeadingSpace - 应该从 collection 配置获取
      tributeInstance.allowSpaces,
      tributeInstance.autocompleteMode
    );

    if (info && info.mentionTriggerChar) {
      return info.mentionTriggerChar.charCodeAt(0);
    }
    return false;
  }

  /**
   * 更新当前选区信息。
   * `this` 指向 `element`。
   * @param {Tribute} tributeInstance - Tribute 主实例的引用。
   * @param {HTMLElement} el - 当前操作的 DOM 元素 (即 `this`)。
   */
  updateSelection(tributeInstance, el) {
    tributeInstance.current.element = el;
    const info = tributeInstance.range.getTriggerInfo(
      false,
      tributeInstance.hasTrailingSpace,
      true, // requireLeadingSpace - 应该从 collection 配置获取
      tributeInstance.allowSpaces,
      tributeInstance.autocompleteMode
    );

    if (info) {
      tributeInstance.current.selectedPath = info.mentionSelectedPath;
      tributeInstance.current.mentionText = info.mentionText;
      tributeInstance.current.selectedOffset = info.mentionSelectedOffset;
    }
  }

  /**
   * 定义各种按键的回调函数。
   * `this` 指向 `element`。
   * @param {Tribute} tributeInstance - Tribute 主实例的引用。
   * @returns {object} - 包含回调函数的对象。
   */
  callbacks(tributeInstance) {
    // 注意：这些回调函数内部的 `this` 将是调用它们的对象，
    // 例如 `this.callbacks(tributeInstance).enter(...)` 中的 `this` 是 TributeEvents 实例。
    // 而回调函数参数 `el` 才是 DOM 元素。
    return {
      /**
       * 处理触发字符。
       * @param {Event} e - 事件对象。
       * @param {HTMLElement} el - DOM 元素。
       * @param {string} trigger - 触发字符。
       */
      triggerChar: (e, el, trigger) => {
        tributeInstance.current.trigger = trigger;

        const collectionItem = tributeInstance.collection.find((item) => {
          return item.trigger === trigger;
        });

        if (!collectionItem) return; // 如果找不到对应的 collection，则不继续
        tributeInstance.current.collection = collectionItem;

        // 确保 mentionText 存在
        const mentionText = tributeInstance.current.mentionText || "";

        if (
          mentionText.length >=
            (tributeInstance.current.collection.menuShowMinLength || 0) &&
          tributeInstance.inputEvent // 通常在 input 事件后触发
        ) {
          tributeInstance.showMenuFor(el, true);
        }
      },
      /**
       * 处理 Enter 键。
       * @param {Event} e - 事件对象。
       * @param {HTMLElement} el - DOM 元素。
       */
      enter: (e, el) => {
        if (tributeInstance.isActive && tributeInstance.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();

          // 如果是多选模式，回车键不应直接选择单个项目，而是可能用于其他操作（例如，触发表单提交），
          // 或者在未来可以配置为切换当前高亮项的勾选状态。
          // 目前，多选模式下的选择完全由勾选框和底部的确认/取消按钮控制。
          // 因此，在多选模式下，回车键的默认选择行为应被阻止。
          if (tributeInstance.current.collection && tributeInstance.current.collection.multipleSelectMode) {
            // 可以考虑，如果焦点在菜单项上，回车切换勾选状态
            // const focusedLi = tributeInstance.menu.menu.querySelector(`li.${tributeInstance.current.collection.selectClass}`);
            // if (focusedLi) {
            //   const checkbox = focusedLi.querySelector('.tribute-menu-item-checkbox');
            //   if (checkbox) {
            //     checkbox.checked = !checkbox.checked;
            //     checkbox.dispatchEvent(new Event('click', {bubbles: true})); // 触发点击以更新状态
            //   }
            // }
            return; // 在多选模式下，回车键不执行默认的单项选择
          }

          // 单选模式下的逻辑
          setTimeout(() => {
            tributeInstance.selectItemAtIndex(tributeInstance.menuSelected, e);
          }, 0);
        }
      },
      /**
       * 处理 Escape 键。
       * @param {Event} e - 事件对象。
       * @param {HTMLElement} el - DOM 元素。
       */
      escape: (e, el) => {
        if (tributeInstance.isActive) {
          e.preventDefault();
          e.stopPropagation();
          tributeInstance.isActive = false; // 直接设置状态
          tributeInstance.hideMenu();
        }
      },
      /**
       * 处理 Tab 键。
       * @param {Event} e - 事件对象。
       * @param {HTMLElement} el - DOM 元素。
       */
      tab: (e, el) => {
        this.callbacks(tributeInstance).enter(e, el); // 委托给 enter 处理
      },
      /**
       * 处理 Space 键。
       * @param {Event} e - 事件对象。
       * @param {HTMLElement} el - DOM 元素。
       */
      space: (e, el) => {
        if (tributeInstance.isActive) {
          if (tributeInstance.spaceSelectsMatch) {
            this.callbacks(tributeInstance).enter(e, el);
          } else if (!tributeInstance.allowSpaces) {
            e.stopPropagation(); // 阻止空格输入
            setTimeout(() => {
              tributeInstance.hideMenu();
              tributeInstance.isActive = false;
            }, 0);
          }
        }
      },
      /**
       * 处理 Up 箭头键。
       * @param {Event} e - 事件对象。
       * @param {HTMLElement} el - DOM 元素。
       */
      up: (e, el) => {
        if (tributeInstance.isActive && tributeInstance.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          const count = tributeInstance.current.filteredItems.length;
          let selected = tributeInstance.menuSelected;

          if (count === 0) return; // 没有项可选

          if (selected > 0) {
            tributeInstance.menuSelected--;
          } else {
            tributeInstance.menuSelected = count - 1; // 循环到最后一项
          }
          tributeInstance.setActiveLi(); // 更新高亮项
        }
      },
      /**
       * 处理 Down 箭头键。
       * @param {Event} e - 事件对象。
       * @param {HTMLElement} el - DOM 元素。
       */
      down: (e, el) => {
        if (tributeInstance.isActive && tributeInstance.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          const count = tributeInstance.current.filteredItems.length;
          let selected = tributeInstance.menuSelected;

          if (count === 0) return; // 没有项可选

          if (selected < count - 1) {
            tributeInstance.menuSelected++;
          } else {
            tributeInstance.menuSelected = 0; // 循环到第一项
          }
          tributeInstance.setActiveLi(); // 更新高亮项
        }
      },
      /**
       * 处理 Delete/Backspace 键。
       * @param {Event} e - 事件对象。
       * @param {HTMLElement} el - DOM 元素。
       */
      delete: (e, el) => {
        if (
          tributeInstance.isActive &&
          tributeInstance.current.mentionText && // 确保 mentionText 存在
          tributeInstance.current.mentionText.length < 1 &&
          !tributeInstance.autocompleteMode // 在自动完成模式下，删除字符也可能需要重新搜索
        ) {
          tributeInstance.hideMenu();
        } else if (tributeInstance.isActive) {
          // 延迟执行，确保在文本内容更新后再显示/刷新菜单
          setTimeout(() => {
            // 在keyup中已经有showMenuFor的逻辑，这里可能不需要重复调用
            // tributeInstance.showMenuFor(el, true);
             this.updateSelection(tributeInstance, el); // 确保状态更新
             if (tributeInstance.current.mentionText.length >= tributeInstance.current.collection.menuShowMinLength) {
                tributeInstance.showMenuFor(el, true);
             } else {
                tributeInstance.hideMenu();
             }
          }, 0);
        }
      },
    };
  }

  // setActiveLi 方法已移至 Tribute.js 主类，因为它直接操作菜单 DOM 和状态，
  // 而 TributeEvents 主要负责输入元素的事件。

  // getFullHeight 方法是通用的 DOM 工具，如果其他地方也需要，可以考虑放到 utils.js 或一个 DOM utils 模块。
  // 目前仅在 TributeMenuEvents (旧) 中使用，可以根据需要决定其最终位置。
  // 如果不再需要，可以移除。
}

export default TributeEvents;
