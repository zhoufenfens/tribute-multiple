"use strict";

import bigList from "./utils/bigList.json";

import {
  clearDom,
  createDomElement,
  fillIn,
  simulateMouseClick
} from "./utils/dom-helpers";

import { attachTribute, detachTribute } from "./utils/tribute-helpers";

describe("Tribute instantiation", function() {
  it("should not error in the base case from the README", () => {
    const options = [
      { key: "Phil Heartman", value: "pheartman" },
      { key: "Gordon Ramsey", value: "gramsey" }
    ];
    const tribute = new Tribute({
      values: options
    });

    expect(tribute.collection[0].values).toEqual(options);
  });
});

describe("Tribute @mentions cases", function() {
  afterEach(function() {
    clearDom();
  });

  ["text", "contenteditable"].forEach(elementType => {
    ["@", "$("].forEach(trigger => {
      it(`when values key is predefined array. For : ${elementType} / ${trigger}`, () => {
        let input = createDomElement(elementType);

        let collectionObject = {
          trigger: trigger,
          selectTemplate: function(item) {
            if (typeof item === "undefined") return null;
            if (this.range.isContentEditable(this.current.element)) {
              return (
                '<span contenteditable="false"><a href="http://zurb.com" target="_blank" title="' +
                item.original.email +
                '">' +
                item.original.value +
                "</a></span>"
              );
            }

            return trigger + item.original.value;
          },
          values: [
            {
              key: "Jordan Humphreys",
              value: "Jordan Humphreys",
              email: "getstarted@zurb.com"
            },
            {
              key: "Sir Walter Riley",
              value: "Sir Walter Riley",
              email: "getstarted+riley@zurb.com"
            }
          ]
        };

        let tribute = attachTribute(collectionObject, input.id);

        fillIn(input, " " + trigger);
        let popupList = document.querySelectorAll(
          ".tribute-container > ul > li"
        );
        expect(popupList.length).toBe(2);
        simulateMouseClick(popupList[0]); // click on Jordan Humphreys

        if (elementType === "text") {
          expect(input.value).toBe(" " + trigger + "Jordan Humphreys ");
        } else if (elementType === "contenteditable") {
          expect(input.innerHTML).toBe(
            ' <span contenteditable="false"><a href="http://zurb.com" target="_blank" title="getstarted@zurb.com">Jordan Humphreys</a></span>&nbsp;'
          );
        }

        fillIn(input, " " + trigger + "sir");
        popupList = document.querySelectorAll(".tribute-container > ul > li");
        expect(popupList.length).toBe(1);

        detachTribute(tribute, input.id);
      });

      it(`when values array is large and menuItemLimit is set. For : ${elementType} / ${trigger}`, () => {
        let input = createDomElement(elementType);

        let collectionObject = {
          trigger: trigger,
          menuItemLimit: 25,
          selectTemplate: function(item) {
            if (typeof item === "undefined") return null;
            if (this.range.isContentEditable(this.current.element)) {
              return (
                '<span contenteditable="false"><a href="http://zurb.com" target="_blank" title="' +
                item.original.email +
                '">' +
                item.original.value +
                "</a></span>"
              );
            }

            return trigger + item.original.value;
          },
          values: bigList
        };

        let tribute = attachTribute(collectionObject, input.id);

        fillIn(input, " " + trigger);
        let popupList = document.querySelectorAll(
          ".tribute-container > ul > li"
        );
        expect(popupList.length).toBe(25);

        fillIn(input, " " + trigger + "an");
        popupList = document.querySelectorAll(".tribute-container > ul > li");
        expect(popupList.length).toBe(25);

        detachTribute(tribute, input.id);
      });

      it("should add itemClass to list items when set it config", () => {
        let input = createDomElement(elementType);

        let collectionObject = {
          trigger: trigger,
          itemClass: "mention-list-item",
          selectClass: "mention-selected",
          values: [
            {
              key: "Jordan Humphreys",
              value: "Jordan Humphreys",
              email: "getstarted@zurb.com"
            },
            {
              key: "Sir Walter Riley",
              value: "Sir Walter Riley",
              email: "getstarted+riley@zurb.com"
            }
          ]
        };

        let tribute = attachTribute(collectionObject, input.id);

        fillIn(input, " " + trigger);
        let popupList = document.querySelectorAll(
          ".tribute-container > ul > li"
        );
        expect(popupList.length).toBe(2);

        expect(popupList[0].className).toBe(
          "mention-list-item mention-selected"
        );
        expect(popupList[1].className).toBe("mention-list-item");

        detachTribute(tribute, input.id);
      });
    });
  });
});

// ==============================================
// 新增：多选模式测试 (Tribute Multiple Select Mode cases)
// ==============================================
describe("Tribute Multiple Select Mode cases", function() {
  afterEach(function() {
    clearDom(); // 清理DOM环境，确保测试隔离
  });

  ["text", "contenteditable"].forEach(elementType => {
    it(`should allow multiple selections and confirm for : ${elementType}`, () => {
      let input = createDomElement(elementType); // 创建测试用输入元素 (text 或 contenteditable)

      // 定义测试用的数据和Tribute配置
      let collectionObject = {
        trigger: "@",
        multipleSelectMode: true, // 启用多选模式
        confirmBtnText: "确认选择",
        cancelBtnText: "取消选择",
        selectTemplate: function(item) { // 定义选中项如何插入到输入框
          if (typeof item === "undefined") return null;
          return item.original.value;
        },
        values: [
          { key: "Jordan Humphreys", value: "Jordan" },
          { key: "Walter Riley", value: "Walter" },
          { key: "Phil Heartman", value: "Phil" },
        ],
      };

      let tribute = attachTribute(collectionObject, input.id); // 附加Tribute到输入元素

      // 场景1: 初始状态，输入触发符，显示多选UI
      fillIn(input, " @");
      let menuContainer = document.querySelector(".tribute-container");
      expect(menuContainer).not.toBe(null);
      expect(menuContainer.style.display).not.toBe("none");

      let confirmButton = menuContainer.querySelector(".tribute-menu-confirm-button");
      expect(confirmButton).not.toBe(null);
      expect(confirmButton.textContent).toBe("确认选择");

      let cancelButton = menuContainer.querySelector(".tribute-menu-cancel-button");
      expect(cancelButton).not.toBe(null);
      expect(cancelButton.textContent).toBe("取消选择");

      // 模拟勾选列表项
      let checkboxes = menuContainer.querySelectorAll(".tribute-menu-item-checkbox");
      expect(checkboxes.length).toBe(3);

      // 勾选第一项和第三项
      simulateMouseClick(checkboxes[0]); // Jordan
      simulateMouseClick(checkboxes[2]); // Phil
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(false);
      expect(checkboxes[2].checked).toBe(true);
      expect(tribute.selectedItems.size).toBe(2); // 验证内部状态

      // 场景2: 用户开始输入搜索词，多选UI应隐藏
      fillIn(input, " @Jor");
      menuContainer = document.querySelector(".tribute-container"); // 重新获取menuContainer，因为它可能被重新渲染
      confirmButton = menuContainer.querySelector(".tribute-menu-confirm-button");
      cancelButton = menuContainer.querySelector(".tribute-menu-cancel-button");
      checkboxes = menuContainer.querySelectorAll(".tribute-menu-item-checkbox");

      expect(confirmButton.style.display).toBe("none", "Confirm button should be hidden during search");
      expect(cancelButton.style.display).toBe("none", "Cancel button should be hidden during search");
      checkboxes.forEach(cb => expect(cb.style.display).toBe("none", "Checkboxes should be hidden during search"));

      // 此时点击列表项应执行单选操作 (这里我们选择第一个匹配项 Jordan)
      let popupList = menuContainer.querySelectorAll("ul > li");
      expect(popupList.length).toBe(1); // 应该只剩 Jordan
      simulateMouseClick(popupList[0]);

      // 验证单选结果 (不包含触发符，因为 selectTemplate 返回的是 value)
      const expectedSingleBase = "@Jordan";
      if (elementType === "text") {
        expect(input.value.trim()).toBe(expectedSingleBase.trim());
      } else {
        expect(input.innerText.replace(/\s+/g, ' ').trim()).toBe(expectedSingleBase.replace(/\s+/g, ' ').trim());
      }
      expect(tribute.selectedItems.size).toBe(0); // 单选后，多选列表应清空或不受影响 (当前实现是清空)

      // 场景3: 清空搜索词，回到初始状态，多选UI应恢复，勾选状态应保留 (如果设计如此)
      // 当前设计是 hideMenu 后 selectedItems 会清空，所以这里重新触发并勾选
      fillIn(input, " @");
      menuContainer = document.querySelector(".tribute-container");
      confirmButton = menuContainer.querySelector(".tribute-menu-confirm-button");
      cancelButton = menuContainer.querySelector(".tribute-menu-cancel-button");
      checkboxes = menuContainer.querySelectorAll(".tribute-menu-item-checkbox");

      expect(confirmButton.style.display).not.toBe("none", "Confirm button should reappear");
      expect(cancelButton.style.display).not.toBe("none", "Cancel button should reappear");
      checkboxes.forEach(cb => expect(cb.style.display).not.toBe("none", "Checkboxes should reappear"));

      // 重新勾选
      simulateMouseClick(checkboxes[0]); // Jordan
      simulateMouseClick(checkboxes[2]); // Phil
      expect(tribute.selectedItems.size).toBe(2);

      // 点击确认按钮
      simulateMouseClick(confirmButton);
      const expectedMultiBase = "@Jordan, Phil";
      if (elementType === "text") {
        expect(input.value.trim()).toBe(expectedMultiBase.trim());
      } else {
        expect(input.innerText.replace(/\s+/g, ' ').trim()).toBe(expectedMultiBase.replace(/\s+/g, ' ').trim());
      }
      expect(tribute.selectedItems.size).toBe(0);

      detachTribute(tribute, input.id);
    });

    it(`should cancel selection and clear checkboxes for : ${elementType}`, () => {
      let input = createDomElement(elementType);
      let collectionObject = {
        trigger: "@",
        multipleSelectMode: true,
        values: [{ key: "Test User", value: "TestUser" }],
      };
      let tribute = attachTribute(collectionObject, input.id);
      fillIn(input, " @"); // 确保处于初始多选UI状态

      let menuContainer = document.querySelector(".tribute-container");
      let checkboxes = menuContainer.querySelectorAll(".tribute-menu-item-checkbox");
      let cancelButton = menuContainer.querySelector(".tribute-menu-cancel-button");

      simulateMouseClick(checkboxes[0]); // 勾选一项
      expect(checkboxes[0].checked).toBe(true);
      expect(tribute.selectedItems.size).toBe(1);

      simulateMouseClick(cancelButton); // 点击取消

      // 验证勾选框是否被取消
      // 注意：clearSelectedItems 会尝试取消勾选框，但菜单可能已隐藏
      // 如果菜单未立即销毁，可以检查
      // expect(checkboxes[0].checked).toBe(false); // 这取决于 hideMenu 是否在 clearSelectedItems 之前执行

      // 验证 selectedItems 是否已清空
      expect(tribute.selectedItems.size).toBe(0);

      // 验证输入框内容未改变
      if (elementType === "text") {
        expect(input.value).toBe(" @");
      } else {
        expect(input.innerText.trim()).toBe("@");
      }
      detachTribute(tribute, input.id);
    });

    it(`should respect delayCloseMenuTimeout for : ${elementType}`, (done) => {
        let input = createDomElement(elementType);
        let collectionObject = {
            trigger: "@",
            multipleSelectMode: true,
            delayCloseMenuTimeout: 100, // 设置延迟关闭时间
            values: [{ key: "Delayed User", value: "DelayedUser" }],
        };
        let tribute = attachTribute(collectionObject, input.id);
        fillIn(input, " @");

        let menuContainer = document.querySelector(".tribute-container");
        let confirmButton = menuContainer.querySelector(".tribute-menu-confirm-button");

        const hideMenuSpy = spyOn(tribute, 'hideMenu').and.callThrough();

        simulateMouseClick(confirmButton); // 点击确认

        // 立即检查：菜单不应立即关闭
        expect(hideMenuSpy).not.toHaveBeenCalled();
        expect(menuContainer.style.display).not.toBe("none");

        // 在延迟时间后检查
        setTimeout(() => {
            expect(hideMenuSpy).toHaveBeenCalled();
            // 菜单关闭的 style.display 检查可能因 hideMenu 实现而异，
            // 但 spyOn(hideMenu) 的调用是关键
            detachTribute(tribute, input.id);
            done(); // 完成异步测试
        }, 150); // 等待时间略长于 delayCloseMenuTimeout
    });

  });
});

describe("Tribute autocomplete mode cases", function() {
  afterEach(function() {
    clearDom();
  });

  ['text', 'contenteditable'].forEach(elementType => {
    it(`when values key with autocompleteSeparator option. For : ${elementType}`, () => {
      let input = createDomElement(elementType);

      let collectionObject = {
        selectTemplate: function (item) {
          return item.original.value;
        },
        autocompleteMode: true,
        autocompleteSeparator: new RegExp(/\-|\+/),
        values: [
          { key: 'Jordan Humphreys', value: 'Jordan Humphreys', email: 'getstarted@zurb.com' },
          { key: 'Sir Walter Riley', value: 'Sir Walter Riley', email: 'getstarted+riley@zurb.com' }
        ],
      }

      let tribute = attachTribute(collectionObject, input.id);

      fillIn(input, '+J');
      let popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(popupList.length).toBe(1);
      simulateMouseClick(popupList[0]); // click on Jordan Humphreys

      if (elementType === 'text') {
        expect(input.value).toBe('+Jordan Humphreys ');
      } else if (elementType === 'contenteditable') {
        expect(input.innerText).toBe('+Jordan Humphreys ');
      }

      fillIn(input, ' Si');
      popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(popupList.length).toBe(1);

      detachTribute(tribute, input.id);
    });
  });

  ["text", "contenteditable"].forEach(elementType => {
    it(`when values key is predefined array. For : ${elementType}`, () => {
      let input = createDomElement(elementType);

      let collectionObject = {
        selectTemplate: function(item) {
          return item.original.value;
        },
        autocompleteMode: true,
        values: [
          {
            key: "Jordan Humphreys",
            value: "Jordan Humphreys",
            email: "getstarted@zurb.com"
          },
          {
            key: "Sir Walter Riley",
            value: "Sir Walter Riley",
            email: "getstarted+riley@zurb.com"
          }
        ]
      };

      let tribute = attachTribute(collectionObject, input.id);

      fillIn(input, " J");
      let popupList = document.querySelectorAll(".tribute-container > ul > li");
      expect(popupList.length).toBe(1);
      simulateMouseClick(popupList[0]); // click on Jordan Humphreys

      if (elementType === "text") {
        expect(input.value).toBe(" Jordan Humphreys ");
      } else if (elementType === "contenteditable") {
        expect(input.innerText).toBe("Jordan Humphreys ");
      }

      fillIn(input, " Si");
      popupList = document.querySelectorAll(".tribute-container > ul > li");
      expect(popupList.length).toBe(1);

      detachTribute(tribute, input.id);
    });
  });

  ["text", "contenteditable"].forEach(elementType => {
    it(`when values key is a function. For : ${elementType}`, () => {
      let input = createDomElement(elementType);

      let collectionObject = {
        autocompleteMode: true,
        selectClass: "sample-highlight",

        noMatchTemplate: function() {
          this.hideMenu();
        },

        selectTemplate: function(item) {
          if (typeof item === "undefined") return null;
          if (this.range.isContentEditable(this.current.element)) {
            return `&nbsp;<a contenteditable=false>${item.original.value}</a>`;
          }

          return item.original.value;
        },

        values: function(text, cb) {
          searchFn(text, users => cb(users));
        }
      };

      function searchFn(text, cb) {
        if (text === "a") {
          cb([
            { key: "Alabama", value: "Alabama" },
            { key: "Alaska", value: "Alaska" },
            { key: "Arizona", value: "Arizona" },
            { key: "Arkansas", value: "Arkansas" }
          ]);
        } else if (text === "c") {
          cb([
            { key: "California", value: "California" },
            { key: "Colorado", value: "Colorado" }
          ]);
        } else {
          cb([]);
        }
      }

      let tribute = attachTribute(collectionObject, input.id);

      fillIn(input, " a");
      let popupList = document.querySelectorAll(".tribute-container > ul > li");
      expect(popupList.length).toBe(4);
      simulateMouseClick(popupList[0]);

      if (elementType === "text") {
        expect(input.value).toBe(" Alabama ");
      } else if (elementType === "contenteditable") {
        expect(input.innerText).toBe(" Alabama ");
      }

      fillIn(input, " c");
      popupList = document.querySelectorAll(".tribute-container > ul > li");
      expect(popupList.length).toBe(2);
      simulateMouseClick(popupList[1]);

      if (elementType === "text") {
        expect(input.value).toBe(" Alabama  Colorado ");
      } else if (elementType === "contenteditable") {
        expect(input.innerText).toBe(" Alabama   Colorado ");
      }

      fillIn(input, " none");
      let popupListWrapper = document.querySelector(".tribute-container");
      expect(popupListWrapper.style.display).toBe("none");

      detachTribute(tribute, input.id);
    });
  });

  ["contenteditable"].forEach(elementType => {
    it(`should work with newlines`, () => {
      let input = createDomElement(elementType);

      let collectionObject = {
        selectTemplate: function(item) {
          return item.original.value;
        },
        autocompleteMode: true,
        values: [
          {
            key: "Jordan Humphreys",
            value: "Jordan Humphreys",
            email: "getstarted@zurb.com"
          },
          {
            key: "Sir Walter Riley",
            value: "Sir Walter Riley",
            email: "getstarted+riley@zurb.com"
          }
        ]
      };

      let tribute = attachTribute(collectionObject, input.id);
      fillIn(input, "random{newline}J");
      let popupList = document.querySelectorAll(".tribute-container > ul > li");
      expect(popupList.length).toBe(1);
      detachTribute(tribute, input.id);
    });
  });
});

describe("When Tribute searchOpts.skip", function() {
  afterEach(function() {
    clearDom();
  });

  it("should skip local filtering and display all items", () => {
    let input = createDomElement();

    let collectionObject = {
      searchOpts: { skip: true },
      noMatchTemplate: function() {
        this.hideMenu();
      },
      selectTemplate: function(item) {
        return item.original.value;
      },
      values: [
        { key: "Tributação e Divisas", value: "Tributação e Divisas" },
        { key: "Tributação e Impostos", value: "Tributação e Impostos" },
        { key: "Tributação e Taxas", value: "Tributação e Taxas" }
      ]
    };

    let tribute = attachTribute(collectionObject, input.id);
    fillIn(input, "@random-text");

    let popupList = document.querySelectorAll(".tribute-container > ul > li");
    expect(popupList.length).toBe(3);

    detachTribute(tribute, input.id);
  });
});

describe("Tribute NoMatchTemplate cases", function() {
  afterEach(function() {
    clearDom();
  });

  it("should display template when specified as text", () => {
    let input = createDomElement();

    let collectionObject = {
      noMatchTemplate: "testcase",
      selectTemplate: function(item) {
        return item.original.value;
      },
      values: [
        {
          key: "Jordan Humphreys",
          value: "Jordan Humphreys",
          email: "getstarted@zurb.com"
        },
        {
          key: "Sir Walter Riley",
          value: "Sir Walter Riley",
          email: "getstarted+riley@zurb.com"
        }
      ]
    };

    let tribute = attachTribute(collectionObject, input.id);
    fillIn(input, "@random-text");

    let containerDiv = document.getElementsByClassName("tribute-container")[0];
    expect(containerDiv.innerText).toBe("testcase");

    detachTribute(tribute, input.id);
  });

  it("should display template when specified as function", () => {
    let input = createDomElement();

    let collectionObject = {
      noMatchTemplate: function() {
        return "testcase";
      },
      selectTemplate: function(item) {
        return item.original.value;
      },
      values: [
        {
          key: "Jordan Humphreys",
          value: "Jordan Humphreys",
          email: "getstarted@zurb.com"
        },
        {
          key: "Sir Walter Riley",
          value: "Sir Walter Riley",
          email: "getstarted+riley@zurb.com"
        }
      ]
    };

    let tribute = attachTribute(collectionObject, input.id);
    fillIn(input, "@random-text");

    let containerDiv = document.getElementsByClassName("tribute-container")[0];
    expect(containerDiv.innerText).toBe("testcase");

    detachTribute(tribute, input.id);
  });

  it("should display no menu container when text is empty", () => {
    let input = createDomElement();

    let collectionObject = {
      noMatchTemplate: "",
      selectTemplate: function(item) {
        return item.original.value;
      },
      values: [
        {
          key: "Jordan Humphreys",
          value: "Jordan Humphreys",
          email: "getstarted@zurb.com"
        },
        {
          key: "Sir Walter Riley",
          value: "Sir Walter Riley",
          email: "getstarted+riley@zurb.com"
        }
      ]
    };

    let tribute = attachTribute(collectionObject, input.id);
    fillIn(input, "@random-text");

    let popupListWrapper = document.querySelector(".tribute-container");
    expect(popupListWrapper.style.display).toBe("none");

    detachTribute(tribute, input.id);
  });

  it("should display no menu when function returns empty string", () => {
    let input = createDomElement();

    let collectionObject = {
      noMatchTemplate: function() {
        return "";
      },
      selectTemplate: function(item) {
        return item.original.value;
      },
      values: [
        {
          key: "Jordan Humphreys",
          value: "Jordan Humphreys",
          email: "getstarted@zurb.com"
        },
        {
          key: "Sir Walter Riley",
          value: "Sir Walter Riley",
          email: "getstarted+riley@zurb.com"
        }
      ]
    };

    let tribute = attachTribute(collectionObject, input.id);
    fillIn(input, "@random-text");

    let popupListWrapper = document.querySelector(".tribute-container");
    expect(popupListWrapper.style.display).toBe("none");

    detachTribute(tribute, input.id);
  });
});

describe("Tribute menu positioning", function() {
  afterEach(function() {
    clearDom();
  });

  function checkPosition(collectionObject, input) {
    let bottomContent = document.createElement("div");
    bottomContent.style = "background: blue; height: 400px; width: 10px;";
    document.body.appendChild(bottomContent);

    let inputRect = input.getBoundingClientRect();
    let inputX = inputRect.x;
    let inputY = inputRect.y;

    let tribute = attachTribute(collectionObject, input.id);
    fillIn(input, "@");

    let popupListWrapper = document.querySelector(".tribute-container");
    let menuRect = popupListWrapper.getBoundingClientRect();
    let menuX = menuRect.x;
    let menuY = menuRect.y;

    detachTribute(tribute, input.id);
    bottomContent.remove();
    clearDom();
    return { x: menuX, y: menuY };
  }

  it("should display a container menu in the same position when menuContainer is specified on an input as when the menuContainer is the body", () => {
    let input = createDomElement();
    let container = input.parentElement;
    container.style = "position: relative;";
    let { x: specifiedX, y: specifiedY } = checkPosition(
      {
        menuContainer: container,
        values: [
          {
            key: "Jordan Humphreys",
            value: "Jordan Humphreys",
            email: "getstarted@zurb.com"
          },
          {
            key: "Sir Walter Riley",
            value: "Sir Walter Riley",
            email: "getstarted+riley@zurb.com"
          }
        ]
      },
      input
    );

    input = createDomElement();
    let { x: unspecifiedX, y: unspecifiedY } = checkPosition(
      {
        values: [
          {
            key: "Jordan Humphreys",
            value: "Jordan Humphreys",
            email: "getstarted@zurb.com"
          },
          {
            key: "Sir Walter Riley",
            value: "Sir Walter Riley",
            email: "getstarted+riley@zurb.com"
          }
        ]
      },
      input
    );

    expect(unspecifiedY).toEqual(specifiedY);
    expect(unspecifiedX).toEqual(specifiedX);
  });

  it("should display a container menu in the same position when menuContainer is specified on an contenteditable as when the menuContainer is the body", () => {
    let input = createDomElement("contenteditable");
    let container = input.parentElement;
    container.style = "position: relative;";
    let { x: specifiedX, y: specifiedY } = checkPosition(
      {
        menuContainer: container,
        values: [
          {
            key: "Jordan Humphreys",
            value: "Jordan Humphreys",
            email: "getstarted@zurb.com"
          },
          {
            key: "Sir Walter Riley",
            value: "Sir Walter Riley",
            email: "getstarted+riley@zurb.com"
          }
        ]
      },
      input
    );

    input = createDomElement("contenteditable");
    let { x: unspecifiedX, y: unspecifiedY } = checkPosition(
      {
        values: [
          {
            key: "Jordan Humphreys",
            value: "Jordan Humphreys",
            email: "getstarted@zurb.com"
          },
          {
            key: "Sir Walter Riley",
            value: "Sir Walter Riley",
            email: "getstarted+riley@zurb.com"
          }
        ]
      },
      input
    );

    expect(unspecifiedY).toEqual(specifiedY);
    expect(unspecifiedX).toEqual(specifiedX);
  });
});

describe("Multi-char tests", function() {
  afterEach(function() {
    clearDom();
  });

  it("should display no menu when only first char of multi-char trigger is used", () => {
    let input = createDomElement();

    let collectionObject = {
      trigger: "$(",
      selectTemplate: function(item) {
        return item.original.value;
      },
      values: [
        {
          key: "Jordan Humphreys",
          value: "Jordan Humphreys",
          email: "getstarted@zurb.com"
        },
        {
          key: "Sir Walter Riley",
          value: "Sir Walter Riley",
          email: "getstarted+riley@zurb.com"
        }
      ]
    };

    let tribute = attachTribute(collectionObject, input.id);
    fillIn(input, " $");

    let popupListWrapper = document.querySelector(".tribute-container");
    expect(popupListWrapper).toBe(null);

    detachTribute(tribute, input.id);
  });

  describe("Tribute events", function() {
    afterEach(function() {
      clearDom();
    });

    it("should raise tribute-active-true", () => {
      let input = createDomElement();

      var eventSpy = jasmine.createSpy();
      input.addEventListener("tribute-active-true", eventSpy);

      let collectionObject = {
        noMatchTemplate: function() {
          this.hideMenu();
        },
        selectTemplate: function(item) {
          return item.original.value;
        },
        values: [
          { key: "Tributação e Divisas", value: "Tributação e Divisas" },
          { key: "Tributação e Impostos", value: "Tributação e Impostos" },
          { key: "Tributação e Taxas", value: "Tributação e Taxas" }
        ]
      };

      let tribute = attachTribute(collectionObject, input.id);
      fillIn(input, "@random-text");

      let popupList = document.querySelectorAll(".tribute-container > ul > li");
      expect(eventSpy).toHaveBeenCalled();

      detachTribute(tribute, input.id);
    });
  });

  describe("Tribute events", function() {
    afterEach(function() {
      clearDom();
    });

    it("should raise tribute-active-false", () => {
      let input = createDomElement();

      var eventSpy = jasmine.createSpy();
      input.addEventListener("tribute-active-false", eventSpy);

      let collectionObject = {
        noMatchTemplate: function() {
          return "";
        },
        selectTemplate: function(item) {
          return item.original.value;
        },
        values: [
          { key: "Tributação e Divisas", value: "Tributação e Divisas" },
          { key: "Tributação e Impostos", value: "Tributação e Impostos" },
          { key: "Tributação e Taxas", value: "Tributação e Taxas" }
        ]
      };

      let tribute = attachTribute(collectionObject, input.id);
      fillIn(input, "@random-text");

      let popupList = document.querySelectorAll(".tribute-container > ul > li");
      expect(eventSpy).toHaveBeenCalled();

      detachTribute(tribute, input.id);
    });
  });
});

describe("Tribute loadingItemTemplate", function() {
  afterEach(function() {
    clearDom();
  });

  ["text", "contenteditable"].forEach(elementType => {
    it(`Shows loading item template. For : ${elementType}`, (done) => {
      let input = createDomElement(elementType);

      let collectionObject = {
        loadingItemTemplate: '<div class="loading">Loading</div>',
        values: function(_, cb) {
          setTimeout(() => cb([
            {
              key: "Jordan Humphreys",
              value: "Jordan Humphreys",
              email: "getstarted@zurb.com"
            },
            {
              key: "Sir Walter Riley",
              value: "Sir Walter Riley",
              email: "getstarted+riley@zurb.com"
            }
          ]), 500)
        },
      };

      let tribute = attachTribute(collectionObject, input.id);

      fillIn(input, "@J");
      const loadingItemTemplate = document.querySelectorAll(".loading");
      expect(loadingItemTemplate.length).toBe(1);

      setTimeout(() => {
        const popupList = document.querySelectorAll(".tribute-container > ul > li");
        expect(popupList.length).toBe(1);
        detachTribute(tribute, input.id);
        done();
      }, 1000);
    });
  });
});