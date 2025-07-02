class TributeEvents {
  constructor(tribute) {
    this.tribute = tribute;
    this.tribute.events = this;
  }

  static keys() {
    return [
      {
        key: 9,
        value: "TAB"
      },
      {
        key: 8,
        value: "DELETE"
      },
      {
        key: 13,
        value: "ENTER"
      },
      {
        key: 27,
        value: "ESCAPE"
      },
      {
        key: 32,
        value: "SPACE"
      },
      {
        key: 38,
        value: "UP"
      },
      {
        key: 40,
        value: "DOWN"
      }
    ];
  }

  bind(element) {
    element.boundKeydown = this.keydown.bind(element, this);
    element.boundKeyup = this.keyup.bind(element, this);
    element.boundInput = this.input.bind(element, this);

    element.addEventListener("keydown", element.boundKeydown, true);
    element.addEventListener("keyup", element.boundKeyup, true);
    element.addEventListener("input", element.boundInput, true);
  }

  unbind(element) {
    element.removeEventListener("keydown", element.boundKeydown, true);
    element.removeEventListener("keyup", element.boundKeyup, true);
    element.removeEventListener("input", element.boundInput, true);

    delete element.boundKeydown;
    delete element.boundKeyup;
    delete element.boundInput;
  }

  keydown(instance, event) {
    if (instance.shouldDeactivate(event)) {
      instance.tribute.isActive = false;
      instance.tribute.hideMenu();
    }

    let element = this;
    instance.commandEvent = false;

    TributeEvents.keys().forEach(o => {
      if (o.key === event.keyCode) {
        instance.commandEvent = true;
        instance.callbacks()[o.value.toLowerCase()](event, element);
      }
    });
  }

  input(instance, event) {
    instance.inputEvent = true;
    instance.keyup.call(this, instance, event);
  }

  click(instance, event) {
    let tribute = instance.tribute;
    
    const isBtn = event.target.getAttribute('data-tribute-btn')
    if (isBtn) {
      // 点击的是(取消或者确定)按钮
      const isConfirmBtn = isBtn === 'confirm';
      const isCancelBtn = isBtn === 'cancel';
      if (isCancelBtn) {
        tribute.hideMenu();
      }
      if (isConfirmBtn) {
        const suggestDomList = tribute.menu.querySelector('ul')?.children || [];
        if (suggestDomList.length === 0) {
          return;
        }
        const checkedIndexs = [];
        // htmlCollection使用foreach方法
        [].forEach.call(suggestDomList, item => {
          if (item.getAttribute('data-tribute-selected') === '1') {
            checkedIndexs.push(item.getAttribute('data-index'));
          }
        })
        console.log('选中的多选项索引数组', checkedIndexs);
        if (checkedIndexs.length === 0) {
          return tribute.hideMenu();
        }
        // checkedIndexs.forEach(index => {
        //   tribute.selectItemAtIndex(index, event);
        // });
        tribute.selectItemsAtIndexList(checkedIndexs, event);
        tribute.hideMenu();
        
      }
      return;
    }
    if (tribute.menu && tribute.menu.contains(event.target)) {
      let li = event.target;
      event.preventDefault();
      event.stopPropagation();
      while (li.nodeName.toLowerCase() !== "li") {
        li = li.parentNode;
        if (!li || li === tribute.menu) {
          throw new Error("cannot find the <li> container for the click");
        }
      }
      
      // 使用用户初始设定的 _userMultipleSelectMode 判断多选模式
      if (tribute._userMultipleSelectMode) {
        // 多选模式下，切换选中状态
        // 如果 menuItemTemplate 中有 checkbox，优先使用 checkbox 的状态
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) {
          // 如果有 checkbox，点击 label 或 li 时，切换 checkbox 状态
          // 注意：如果直接点击 checkbox，其状态已经改变，这里不需要反转
          // 为简化，我们假设点击 li 或 label 应该切换 checkbox
          // 如果是直接点击 checkbox，event.target 可能是 checkbox 本身
          // 浏览器会处理 label 点击时 checkbox 状态的切换。
          // 我们的 preventDefault() 可能会阻止 label 的默认行为，
          // 但也可能不会完全阻止所有浏览器的状态同步。
          // 最稳妥的是，如果 event.target 不是 checkbox，我们才尝试同步状态，
          // 但要避免双重反转。

          if (event.target === checkbox) {
            // Clicked directly on the checkbox.
            // Its 'checked' state is already updated by the browser prior to this event handler
            // (or rather, our preventDefault might not even stop this for a checkbox itself).
            // So, we just read its current state.
            li.setAttribute('data-tribute-selected', checkbox.checked ? '1' : '0');
          } else {
            // Clicked on the li or label (anything but the checkbox itself).
            // Since preventDefault() is called, the label won't toggle the checkbox automatically.
            // So, we must do it manually.
            checkbox.checked = !checkbox.checked;
            li.setAttribute('data-tribute-selected', checkbox.checked ? '1' : '0');
          }
        } else {
          // No checkbox in template
          let currentSelectedState = li.getAttribute('data-tribute-selected') === '1';
          li.setAttribute('data-tribute-selected', !currentSelectedState ? '1' : '0');
        }
        // 多选模式下菜单保持打开
      } else {
        // 单选模式
        tribute.selectItemAtIndex(li.getAttribute("data-index"), event);
        tribute.hideMenu();
      }

      // TODO: should fire with externalTrigger and target is outside of menu
    } else if (tribute.current.element && !tribute.current.externalTrigger) {
      tribute.current.externalTrigger = false;
      setTimeout(() => tribute.hideMenu());
    }
  }

  keyup(instance, event) {
    if (instance.inputEvent) {
      instance.inputEvent = false;
    }
    instance.updateSelection(this);

    if (!event.keyCode || event.keyCode === 27) return;

    if (!instance.tribute.allowSpaces && instance.tribute.hasTrailingSpace) {
      instance.tribute.hasTrailingSpace = false;
      instance.commandEvent = true;
      instance.callbacks()["space"](event, this);
      return;
    }

    if (!instance.tribute.isActive) {
      if (instance.tribute.autocompleteMode) {
        instance.callbacks().triggerChar(event, this, "");
      } else {
        let keyCode = instance.getKeyCode(instance, this, event);

        if (isNaN(keyCode) || !keyCode) return;

        let trigger = instance.tribute.triggers().find(trigger => {
          return trigger.charCodeAt(0) === keyCode;
        });

        if (typeof trigger !== "undefined") {
          instance.callbacks().triggerChar(event, this, trigger);
        }
      }
    }
    
    // 只输入trigger字符时，更新菜单的显示（如果需要，例如添加/移除多选相关的class）
    // 但 multipleSelectMode 本身应由 _userMultipleSelectMode 控制
    if (instance.tribute.menu) { // 确保菜单存在
      if (instance.tribute._userMultipleSelectMode && instance.tribute.current.mentionText.length === 0) {
        // 如果用户配置了多选，并且是刚输入trigger的场景，确保菜单有多选样式和按钮
        instance.tribute.menu.classList.add('multiple-select-mode');
        // 确保按钮在需要时显示（createMenu中已处理，这里是应对showMenuFor中可能的动态调整）
         if (!instance.tribute.menu.querySelector('.tribute-btn-wrapper') && instance.tribute.range.getDocument().body.contains(instance.tribute.menu)) {
            // 这个逻辑比较复杂，createMenu时按钮已创建，这里主要是确保class正确
            // 如果按钮的显示/隐藏完全依赖于 multiple-select-mode class，则下方showMenuFor中的处理可能已足够
        }
      } else if (instance.tribute.menu.classList.contains('multiple-select-mode') && !instance.tribute._userMultipleSelectMode) {
        // 如果用户未配置多选，但菜单仍有多选样式（不太可能发生，除非直接操作了实例的multipleSelectMode）
        // instance.tribute.menu.classList.remove('multiple-select-mode');
      }
    }
    // 移除动态修改 tribute.multipleSelectMode 的逻辑
    // instance.tribute.multipleSelectMode = instance.tribute._userMultipleSelectMode;


    if (
      instance.tribute.current.mentionText.length <
      instance.tribute.current.collection.menuShowMinLength
    ) {
      return;
    }
    

    if (
      ((instance.tribute.current.trigger ||
        instance.tribute.autocompleteMode) &&
        instance.commandEvent === false) ||
      (instance.tribute.isActive && event.keyCode === 8)
    ) {
      instance.tribute.showMenuFor(this, true);
    }
  }

  shouldDeactivate(event) {
    if (!this.tribute.isActive) return false;

    if (this.tribute.current.mentionText.length === 0) {
      let eventKeyPressed = false;
      TributeEvents.keys().forEach(o => {
        if (event.keyCode === o.key) eventKeyPressed = true;
      });

      return !eventKeyPressed;
    }

    return false;
  }

  getKeyCode(instance, el, event) {
    let char;
    let tribute = instance.tribute;
    let info = tribute.range.getTriggerInfo(
      false,
      tribute.hasTrailingSpace,
      true,
      tribute.allowSpaces,
      tribute.autocompleteMode
    );

    if (info) {
      return info.mentionTriggerChar.charCodeAt(0);
    } else {
      return false;
    }
  }

  updateSelection(el) {
    this.tribute.current.element = el;
    let info = this.tribute.range.getTriggerInfo(
      false,
      this.tribute.hasTrailingSpace,
      true,
      this.tribute.allowSpaces,
      this.tribute.autocompleteMode
    );

    if (info) {
      this.tribute.current.selectedPath = info.mentionSelectedPath;
      this.tribute.current.mentionText = info.mentionText;
      this.tribute.current.selectedOffset = info.mentionSelectedOffset;
    }
  }

  callbacks() {
    return {
      triggerChar: (e, el, trigger) => {
        let tribute = this.tribute;
        tribute.current.trigger = trigger;

        let collectionItem = tribute.collection.find(item => {
          return item.trigger === trigger;
        });

        tribute.current.collection = collectionItem;

        if (
          tribute.current.mentionText.length >=
            tribute.current.collection.menuShowMinLength &&
          tribute.inputEvent
        ) {
          tribute.showMenuFor(el, true);
        }
      },
      enter: (e, el) => {
        // choose selection
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          setTimeout(() => {
            this.tribute.selectItemAtIndex(this.tribute.menuSelected, e);
            this.tribute.hideMenu();
          }, 0);
        }
      },
      escape: (e, el) => {
        if (this.tribute.isActive) {
          e.preventDefault();
          e.stopPropagation();
          this.tribute.isActive = false;
          this.tribute.hideMenu();
        }
      },
      tab: (e, el) => {
        // choose first match
        this.callbacks().enter(e, el);
      },
      space: (e, el) => {
        if (this.tribute.isActive) {
          if (this.tribute.spaceSelectsMatch) {
            this.callbacks().enter(e, el);
          } else if (!this.tribute.allowSpaces) {
            e.stopPropagation();
            setTimeout(() => {
              this.tribute.hideMenu();
              this.tribute.isActive = false;
            }, 0);
          }
        }
      },
      up: (e, el) => {
        // navigate up ul
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          let count = this.tribute.current.filteredItems.length,
            selected = this.tribute.menuSelected;

          if (count > selected && selected > 0) {
            this.tribute.menuSelected--;
            this.setActiveLi();
          } else if (selected === 0) {
            this.tribute.menuSelected = count - 1;
            this.setActiveLi();
            this.tribute.menu.scrollTop = this.tribute.menu.scrollHeight;
          }
        }
      },
      down: (e, el) => {
        // navigate down ul
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          let count = this.tribute.current.filteredItems.length - 1,
            selected = this.tribute.menuSelected;

          if (count > selected) {
            this.tribute.menuSelected++;
            this.setActiveLi();
          } else if (count === selected) {
            this.tribute.menuSelected = 0;
            this.setActiveLi();
            this.tribute.menu.scrollTop = 0;
          }
        }
      },
      delete: (e, el) => {
        if (
          this.tribute.isActive &&
          this.tribute.current.mentionText.length < 1
        ) {
          this.tribute.hideMenu();
        } else if (this.tribute.isActive) {
          this.tribute.showMenuFor(el);
        }
      }
    };
  }

  setActiveLi(index) {
    let lis = this.tribute.menu.querySelectorAll("li"),
      length = lis.length >>> 0;

    if (index) this.tribute.menuSelected = parseInt(index);

    for (let i = 0; i < length; i++) {
      let li = lis[i];
      if (i === this.tribute.menuSelected) {
        li.classList.add(this.tribute.current.collection.selectClass);

        let liClientRect = li.getBoundingClientRect();
        let menuClientRect = this.tribute.menu.getBoundingClientRect();

        if (liClientRect.bottom > menuClientRect.bottom) {
          let scrollDistance = liClientRect.bottom - menuClientRect.bottom;
          this.tribute.menu.scrollTop += scrollDistance;
        } else if (liClientRect.top < menuClientRect.top) {
          let scrollDistance = menuClientRect.top - liClientRect.top;
          this.tribute.menu.scrollTop -= scrollDistance;
        }
      } else {
        li.classList.remove(this.tribute.current.collection.selectClass);
      }
    }
  }

  getFullHeight(elem, includeMargin) {
    let height = elem.getBoundingClientRect().height;

    if (includeMargin) {
      let style = elem.currentStyle || window.getComputedStyle(elem);
      return (
        height + parseFloat(style.marginTop) + parseFloat(style.marginBottom)
      );
    }

    return height;
  }
}

export default TributeEvents;
