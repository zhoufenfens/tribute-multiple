// src/TributeConfig.js

/**
 * @class TributeConfig
 * @classdesc 处理 Tribute 实例的配置。此类负责初始化和管理所有与配置相关的选项，
 * 包括触发符、数据集合、模板函数等。
 */
class TributeConfig {
  /**
   * 构造函数。
   * @param {object} options - 用户提供的配置选项。
   * @param {Array<object>|Function|null} options.values - 提供给提及菜单的数据源。可以是对象数组或返回对象数组的函数。
   * @param {string|null} options.loadingItemTemplate - 当 `values` 是异步函数时，在加载数据期间显示的模板。
   * @param {HTMLIFrameElement|null} options.iframe - 如果 Tribute 附加在 iframe 内的元素上，则需要提供此 iframe 元素的引用。
   * @param {string} options.selectClass - 应用于菜单中选中项的 CSS 类名。默认为 "highlight"。
   * @param {string} options.containerClass - 应用于提及菜单容器 (div) 的 CSS 类名。默认为 "tribute-container"。
   * @param {string} options.itemClass - 应用于提及菜单中每个列表项 (li) 的 CSS 类名。默认为空字符串。
   * @param {string} options.trigger - 触发提及菜单的字符。默认为 "@"。
   * @param {boolean} options.autocompleteMode - 是否启用自动完成模式。在此模式下，不使用触发字符，菜单会根据输入内容自动显示。默认为 false。
   * @param {string|null} options.autocompleteSeparator - 在自动完成模式下，用于分隔多个提及的分隔符。
   * @param {Function|null} options.selectTemplate - 选择一个项目后，用于生成插入到输入区域内容的模板函数。
   * @param {Function|null} options.menuItemTemplate - 用于生成菜单中每个项目显示的 HTML 的模板函数。
   * @param {string|Function} options.lookup - 在数据对象中用于搜索匹配项的属性名，或一个自定义的查找函数。默认为 "key"。
   * @param {string} options.fillAttr - 在数据对象中用于填充替换文本的属性名。默认为 "value"。
   * @param {Array<object>|null} options.collection - 一个更复杂的配置结构，允许为不同的触发符定义不同的行为和数据源。
   * @param {HTMLElement|null} options.menuContainer - 指定提及菜单应附加到的父 DOM 元素。默认为 document.body。
   * @param {string|Function|null} options.noMatchTemplate - 当没有找到匹配项时，在菜单中显示的模板。可以是 HTML 字符串或返回 HTML 字符串的函数。
   * @param {boolean} options.requireLeadingSpace - 是否要求在触发字符前有一个空格。默认为 true。
   * @param {boolean} options.allowSpaces - 是否允许在提及的文本中包含空格。默认为 false。
   * @param {string|null} options.replaceTextSuffix - 替换文本后自动添加的后缀字符串，例如一个空格。默认为 null (内部会根据情况处理为空格或 &nbsp;)。
   * @param {boolean} options.positionMenu - 是否允许 Tribute 自动定位菜单。默认为 true。
   * @param {boolean} options.spaceSelectsMatch - 按下空格键时是否选择当前高亮的匹配项。默认为 false。
   * @param {object} options.searchOpts - 传递给搜索/过滤逻辑的附加选项 (例如，模糊搜索的前缀/后缀高亮标签)。
   * @param {number|null} options.menuItemLimit - 菜单中显示的最大项目数量。默认为 null (无限制)。
   * @param {number} options.menuShowMinLength - 触发显示菜单所需输入的最小字符数。默认为 0。
   */
  constructor({
    values = null,
    loadingItemTemplate = null,
    iframe = null,
    selectClass = "highlight", // 选中项的CSS类
    containerClass = "tribute-container", // 菜单容器的CSS类
    itemClass = "", // 菜单项的CSS类
    trigger = "@", // 触发字符
    autocompleteMode = false, // 自动完成模式开关
    autocompleteSeparator = null, // 自动完成模式下的分隔符
    selectTemplate = null, // 选择模板
    menuItemTemplate = null, // 菜单项模板
    lookup = "key", // 查找属性
    fillAttr = "value", // 填充属性
    collection = null, // 集合配置
    menuContainer = null, // 菜单容器DOM元素
    noMatchTemplate = null, // 无匹配模板
    requireLeadingSpace = true, // 是否需要前导空格
    allowSpaces = false, // 是否允许提及内容包含空格
    replaceTextSuffix = null, // 替换文本后缀
    positionMenu = true, // 是否定位菜单
    spaceSelectsMatch = false, // 空格是否选择匹配项
    searchOpts = {}, // 搜索选项
    menuItemLimit = null, // 菜单项数量限制
    menuShowMinLength = 0, // 菜单显示最小长度
  }) {
    // 存储所有配置选项
    this.autocompleteMode = autocompleteMode;
    this.autocompleteSeparator = autocompleteSeparator;
    this.menuContainer = menuContainer;
    this.allowSpaces = allowSpaces;
    this.replaceTextSuffix = replaceTextSuffix;
    this.positionMenu = positionMenu;
    this.spaceSelectsMatch = spaceSelectsMatch;

    // tributeInstance 将由 Tribute 主类在实例化 TributeConfig后设置。
    // 这对于默认模板函数能够访问 Tribute 实例的 `current` 和 `range` 属性至关重要。
    this.tributeInstance = null;

    // 如果是自动完成模式，则触发字符置空，且不允许空格（因为空格通常用于分隔单词）
    if (this.autocompleteMode) {
      trigger = "";
      allowSpaces = false; // 通常在自动完成模式下，空格会结束当前输入并开始新的建议
    }

    // 处理 `values` 和 `collection` 配置的优先级和转换
    if (values) {
      // 如果提供了 `values`，将其构造成一个单元素的 `collection`
      this.collection = [
        {
          trigger: trigger,
          iframe: iframe,
          selectClass: selectClass,
          containerClass: containerClass,
          itemClass: itemClass,
          selectTemplate: selectTemplate || TributeConfig.defaultSelectTemplate,
          menuItemTemplate: menuItemTemplate || TributeConfig.defaultMenuItemTemplate,
          noMatchTemplate: this._getNoMatchTemplateResolver(noMatchTemplate), // 解析无匹配模板
          lookup: lookup,
          fillAttr: fillAttr,
          values: values,
          loadingItemTemplate: loadingItemTemplate,
          requireLeadingSpace: requireLeadingSpace,
          searchOpts: searchOpts,
          menuItemLimit: menuItemLimit,
          menuShowMinLength: menuShowMinLength,
        },
      ];
    } else if (collection) {
      // 如果提供了 `collection`，则使用它，并为每个集合项填充默认值
      if (this.autocompleteMode) {
        // 自动完成模式下，通常不使用多集合配置，因为没有显式的触发符来区分它们
        console.warn(
          "Tribute: 在自动完成模式下，多集合配置可能无法按预期工作。"
        );
      }
      this.collection = collection.map((item) => {
        // 为集合中的每个配置项应用默认值
        return {
          trigger: item.trigger || trigger,
          iframe: item.iframe || iframe,
          selectClass: item.selectClass || selectClass,
          containerClass: item.containerClass || containerClass,
          itemClass: item.itemClass || itemClass,
          selectTemplate:
            item.selectTemplate || TributeConfig.defaultSelectTemplate,
          menuItemTemplate:
            item.menuItemTemplate || TributeConfig.defaultMenuItemTemplate,
          noMatchTemplate: this._getNoMatchTemplateResolver(item.noMatchTemplate || noMatchTemplate),
          lookup: item.lookup || lookup,
          fillAttr: item.fillAttr || fillAttr,
          values: item.values,
          loadingItemTemplate: item.loadingItemTemplate,
          requireLeadingSpace: item.requireLeadingSpace !== undefined ? item.requireLeadingSpace : requireLeadingSpace,
          searchOpts: item.searchOpts || searchOpts,
          menuItemLimit: item.menuItemLimit || menuItemLimit,
          menuShowMinLength: item.menuShowMinLength || menuShowMinLength,
        };
      });
    } else {
      throw new Error("[Tribute] No collection specified.");
    }

    // Bind context for default templates if they are used
    // This binding ensures that 'this' inside these templates refers to the TributeConfig instance,
    // and through `this.tributeInstance`, to the main Tribute instance's properties.
    this.collection.forEach(col => {
        if (col.selectTemplate === TributeConfig.defaultSelectTemplate) {
            col.selectTemplate = col.selectTemplate.bind(this);
        }
        if (col.menuItemTemplate === TributeConfig.defaultMenuItemTemplate) {
            // menuItemTemplate is static and doesn't rely on `this` from Tribute instance
            // but if it were to, it would be bound here too.
            // For now, it's simple and takes matchItem directly.
        }
         // The noMatchTemplate is resolved to a function by _getNoMatchTemplateResolver
         // and then bound here to ensure `this` context if it's a custom function.
        if (typeof col.noMatchTemplate === 'function') {
            col.noMatchTemplate = col.noMatchTemplate.bind(this.tributeInstance || this);
        }
    });
  }

  /**
   * 设置Tribute实例的引用。
   * 这对于默认模板函数能够访问Tribute实例的 `current` 和 `range` 属性至关重要。
   * @param {Tribute} instance - Tribute主类的实例。
   */
  setTributeInstance(instance) {
    this.tributeInstance = instance;
    // Re-bind noMatchTemplate if it was a function, to ensure it has the tributeInstance context
    this.collection.forEach(col => {
        if (typeof col.noMatchTemplate === 'function') {
            // Check if it's the default one we provided, or a user's function
            // The default one from _getNoMatchTemplateResolver is already fine
            // User provided functions will be bound to the tribute instance
            if (col.noMatchTemplate.name !== 'defaultNoMatch') {
                 col.noMatchTemplate = col.noMatchTemplate.bind(this.tributeInstance);
            }
        }
    });
  }

  /**
   * 解析“无匹配”模板。
   * @param {string | Function | null} t - 用户提供的模板。
   * @returns {Function | string | null} - 处理后的模板。
   * @private
   */
  _getNoMatchTemplateResolver(t) {
    if (typeof t === "string") {
      if (t.trim() === "") return null;
      return t; // 将作为字符串直接使用
    }
    if (typeof t === "function") {
      return t; // 将在之后绑定 `this` 上下文
    }
    // 默认的无匹配模板函数
    return function defaultNoMatch() {
        return "<li>No Match Found!</li>";
    }.bind(this.tributeInstance || this); // 绑定到tributeInstance或当前config实例
  }

  /**
   * 默认的选择模板函数。
   * 重要提示: 此函数在调用时，其 `this` 上下文应为 `TributeConfig` 实例，
   * 并且 `this.tributeInstance` 必须已经被设置，以便能访问 `this.tributeInstance.current` 和 `this.tributeInstance.range`。
   * @param {object} item - 选中的项目。
   * @returns {string} - 用于替换的HTML字符串。
   */
  static defaultSelectTemplate(item) {
    // `this` is bound to TributeConfig instance by the constructor
    // `this.tributeInstance` provides access to Tribute's state
    const tribute = this.tributeInstance;
    if (!tribute || !tribute.current || !tribute.range) {
        // Fallback or error if tributeInstance is not correctly set up
        // This might happen if called in a context where tributeInstance isn't available
        console.error("Tribute instance/current/range not available in defaultSelectTemplate");
        if (tribute && tribute.current && tribute.current.collection) {
             return `${tribute.current.collection.trigger}${item && item.original ? item.original[tribute.current.collection.fillAttr] : ''}`;
        }
        return '';
    }

    if (typeof item === "undefined") {
      return `${tribute.current.collection.trigger}${tribute.current.mentionText}`;
    }
    if (tribute.range.isContentEditable(tribute.current.element)) {
      return (
        '<span class="tribute-mention">' +
        (tribute.current.collection.trigger +
          item.original[tribute.current.collection.fillAttr]) +
        "</span>"
      );
    }
    return (
      tribute.current.collection.trigger +
      item.original[tribute.current.collection.fillAttr]
    );
  }

  /**
   * 默认的菜单项模板函数。
   * @param {object} matchItem - 匹配的项目。
   * @returns {string} - 用于显示在菜单项中的HTML字符串。
   */
  static defaultMenuItemTemplate(matchItem) {
    return matchItem.string;
  }

  /**
   * 返回支持的输入类型。
   * @returns {string[]} - 输入类型数组。
   */
  static inputTypes() {
    return ["TEXTAREA", "INPUT"];
  }

  /**
   * 获取所有配置的触发字符。
   * @returns {string[]} - 触发字符数组。
   */
  triggers() {
    return this.collection.map((config) => {
      return config.trigger;
    });
  }
}

export default TributeConfig;
