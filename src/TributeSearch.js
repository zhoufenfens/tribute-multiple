// src/TributeSearch.js
// 搜索逻辑部分参考了 https://github.com/mattyork/fuzzy (模糊搜索库)

/**
 * @class TributeSearch
 * @classdesc 提供用于在数据集合中搜索和过滤匹配项的功能。
 *            支持简单的子字符串匹配和更复杂的模糊搜索（如果实现）。
 *            结果会根据匹配得分进行排序。
 */
class TributeSearch {
  /**
   * TributeSearch 构造函数。
   * @param {Tribute} tribute - Tribute 主实例的引用。用于访问配置，例如 `autocompleteSeparator`。
   */
  constructor(tribute) {
    this.tribute = tribute; // 保存对主 Tribute 实例的引用
    // this.tribute.search = this; // 主 Tribute 实例已在其构造函数中将 this.search 设置为本实例
  }

  /**
   * 简单的子字符串过滤方法。
   * 检查 `array` 中的每个字符串是否包含 `pattern`。
   * @param {string} pattern - 要搜索的模式字符串。
   * @param {Array<string>} array - 要在其中搜索的字符串数组。
   * @returns {Array<string>} - 包含 `pattern` 的字符串数组。
   * @deprecated 此方法可能未在当前版本的 Tribute 中积极使用，`filter` 方法是主要的搜索接口。
   */
  simpleFilter(pattern, array) {
    return array.filter(string => {
      return this.test(pattern, string);
    });
  }

  /**
   * 测试一个字符串 (`string`) 是否匹配一个模式 (`pattern`)。
   * @param {string} pattern - 要测试的模式。
   * @param {string} string - 要被测试的字符串。
   * @returns {boolean} - 如果匹配则返回 `true`，否则返回 `false`。
   * @deprecated 同 `simpleFilter`，主要搜索逻辑在 `match` 和 `filter` 中。
   */
  test(pattern, string) {
    return this.match(pattern, string) !== null;
  }

  /**
   * 执行核心的匹配逻辑，找出 `pattern` 在 `string` 中的匹配情况。
   * 此方法实现了模糊搜索的关键部分，计算匹配得分并记录匹配的字符索引。
   * @param {string} pattern - 要搜索的模式。
   * @param {string} string - 在其中搜索的源字符串。
   * @param {object} [opts={}] - 匹配选项。
   * @param {string} [opts.pre=''] - 匹配字符的前缀（用于高亮）。
   * @param {string} [opts.post=''] - 匹配字符的后缀（用于高亮）。
   * @param {boolean} [opts.caseSensitive=false] - 是否区分大小写。默认为不区分。
   * @param {boolean} [opts.skip=false] - 如果为 true，则跳过匹配并返回原始字符串和0分。
   * @returns {{rendered: string, score: number} | null} - 如果匹配成功，返回一个包含渲染后的字符串（带高亮）和匹配得分的对象；
   *                                                       如果不匹配，则返回 `null`。
   */
  match(pattern, string, opts = {}) {
    // let patternIdx = 0; // 未在此函数直接使用，可能用于其他匹配策略
    // let result = [];    // 未在此函数直接使用
    // let len = string.length; // 未在此函数直接使用
    // let totalScore = 0; // 分数计算在 traverse 和 calculateScore 中
    // let currScore = 0;  // 同上

    const pre = opts.pre || '';   // 高亮前缀，默认为空字符串
    const post = opts.post || ''; // 高亮后缀，默认为空字符串
    // 根据 caseSensitive 选项决定是否将源字符串和模式转换为小写进行比较
    const compareString = opts.caseSensitive ? string : string.toLowerCase();
    // let ch, compareChar; // 未在此函数直接使用

    // 如果设置了 skip 选项，则直接返回原始字符串和0分
    if (opts.skip) {
      return { rendered: string, score: 0 };
    }

    // 根据 caseSensitive 选项转换模式字符串
    const searchPattern = opts.caseSensitive ? pattern : pattern.toLowerCase();

    // 调用 traverse 方法进行递归的模糊匹配，获取匹配的索引缓存和总分
    const patternCache = this.traverse(compareString, searchPattern, 0, 0, []);
    if (!patternCache) {
      return null; // traverse 未找到匹配，返回 null
    }
    // 如果找到匹配，使用 render 方法根据索引缓存生成高亮后的字符串
    return {
      rendered: this.render(string, patternCache.cache, pre, post), // 原始大小写字符串用于渲染
      score: patternCache.score, // 匹配得分
    };
  }

  /**
   * 递归遍历源字符串，尝试匹配模式字符串中的每个字符。
   * 这是模糊搜索算法的核心，它寻找模式字符在源字符串中出现的最佳（得分最高）序列。
   * @param {string} string - (通常是小写形式的) 源字符串。
   * @param {string} pattern - (通常是小写形式的) 模式字符串。
   * @param {number} stringIndex - 当前在源字符串中开始搜索的索引。
   * @param {number} patternIndex - 当前尝试匹配的模式字符串中的字符索引。
   * @param {Array<number>} patternCache - 存储当前匹配路径中，模式字符在源字符串中对应索引的数组。
   * @returns {{score: number, cache: Array<number>} | undefined} - 如果找到完整匹配，返回包含最终得分和最佳匹配索引路径的对象；
   *                                                               如果无法匹配，则返回 `undefined`。
   * @private
   */
  traverse(string, pattern, stringIndex, patternIndex, patternCache) {
    // 如果 Tribute 配置了自动完成分隔符，并且模式中包含该分隔符，
    // 则只使用分隔符最后一部分作为实际搜索的模式。
    // 例如，如果分隔符是 " "，模式是 "user name"，则实际搜索 "name"。
    if (this.tribute.autocompleteSeparator) {
      const parts = pattern.split(this.tribute.autocompleteSeparator);
      if (parts.length > 1) {
        pattern = parts.pop(); // 使用最后一部分
        patternIndex = 0; // 重置模式索引，因为我们现在用的是新的短模式
      }
    }

    // 基本情况：如果模式中的所有字符都已成功匹配 (patternIndex 到达模式末尾)
    if (pattern.length === patternIndex) {
      // 计算当前匹配路径 (patternCache) 的得分
      // 并返回得分和当前路径的副本 (使用 slice() 防止后续递归修改)
      return {
        score: this.calculateScore(patternCache),
        cache: patternCache.slice(),
      };
    }

    // 剪枝：如果源字符串已遍历完毕 (stringIndex 到达末尾)，
    // 或者剩余的模式字符数量大于剩余的源字符串字符数量，
    // 则不可能找到完整匹配，返回 undefined。
    if (string.length === stringIndex || pattern.length - patternIndex > string.length - stringIndex) {
      return undefined;
    }

    let bestMatch = undefined; // 用于存储当前递归分支下找到的最佳匹配
    const charToMatch = pattern[patternIndex]; // 当前需要匹配的模式字符

    // 从 stringIndex 开始，在源字符串中查找 charToMatch
    let indexOfChar = string.indexOf(charToMatch, stringIndex);
    // 循环查找所有出现的 charToMatch
    while (indexOfChar > -1) {
      patternCache.push(indexOfChar); // 将当前找到的字符索引加入匹配路径
      // 递归调用 traverse，尝试匹配模式中的下一个字符 (patternIndex + 1)，
      // 从源字符串中当前字符的下一个位置开始搜索 (indexOfChar + 1)。
      const
递归匹配结果 = this.traverse(string, pattern, indexOfChar + 1, patternIndex + 1, patternCache);
      patternCache.pop(); // 回溯：从路径中移除当前字符索引，为下一次循环或上一层递归做准备

      // 如果递归调用返回了一个有效匹配 (temp)
      if (递归匹配结果) {
        // 如果这是当前分支找到的第一个匹配，或者新匹配的得分更高，则更新 bestMatch
        if (!bestMatch || bestMatch.score < 递归匹配结果.score) {
          bestMatch = 递归匹配结果;
        }
      }
      // 继续在源字符串中查找下一个 charToMatch (从上一个找到的位置之后开始)
      indexOfChar = string.indexOf(charToMatch, indexOfChar + 1);
    }
    return bestMatch; // 返回当前递归分支找到的最佳匹配 (可能是 undefined)
  }

  /**
   * 根据匹配的索引缓存计算匹配得分。
   * 得分策略：连续匹配的字符会获得更高的分数。
   * @param {Array<number>} patternCache - 包含模式字符在源字符串中匹配位置索引的数组。
   * @returns {number} - 计算得到的匹配总分。
   * @private
   */
  calculateScore(patternCache) {
    let score = 0; // 总分
    let consecutiveBonus = 1; // 连续匹配的奖励基数

    patternCache.forEach((matchIndex, i) => {
      // 如果不是第一个匹配的字符 (i > 0)
      if (i > 0) {
        // 检查当前匹配字符是否紧跟在前一个匹配字符之后 (连续匹配)
        if (patternCache[i - 1] + 1 === matchIndex) {
          consecutiveBonus += consecutiveBonus + 1; // 连续匹配，增加奖励值 (例如，1, 3, 7, 15...)
        } else {
          consecutiveBonus = 1; // 非连续匹配，重置奖励基数
        }
      }
      score += consecutiveBonus; // 将当前字符的得分（或奖励）加到总分
    });
    return score;
  }

  /**
   * 根据匹配的索引和高亮选项，渲染（构建）最终显示的字符串。
   * 匹配的字符会被 `pre` 和 `post` 字符串包裹。
   * @param {string} originalString - 原始的、未经大小写转换的字符串。
   * @param {Array<number>} indices - 模式中每个字符在（小写）源字符串中匹配的索引位置数组。
   * @param {string} pre - 高亮前缀字符串 (例如 "<span>")。
   * @param {string} post - 高亮后缀字符串 (例如 "</span>")。
   * @returns {string} - 包含高亮标记的渲染后字符串。
   * @private
   */
  render(originalString, indices, pre, post) {
    // 从原始字符串的开头截取到第一个匹配字符之前的部分
    let renderedString = originalString.substring(0, indices[0]);

    // 遍历所有匹配的索引
    indices.forEach((matchIndex, i) => {
      // 添加高亮前缀 + 原始字符串中对应索引的字符 + 高亮后缀
      renderedString += pre + originalString[matchIndex] + post;
      // 添加从当前匹配字符之后，到下一个匹配字符之前（或字符串末尾）的子串
      const nextIndex = indices[i + 1]; // 下一个匹配字符的索引
      renderedString += originalString.substring(matchIndex + 1, nextIndex !== undefined ? nextIndex : originalString.length);
    });
    return renderedString;
  }

  /**
   * 在一个对象数组 (`arr`) 中过滤出与模式 (`pattern`) 匹配的元素。
   * @param {string} pattern - 要搜索的模式。
   * @param {Array<object>|Array<string>} arr - 要搜索的数组。数组元素可以是字符串或包含待搜索属性的对象。
   * @param {object} [opts={}] - 传递给 `match` 方法的选项，以及一个额外的 `extract` 函数。
   * @param {Function} [opts.extract] - 一个函数，用于从数组中的每个元素提取出用于搜索的字符串。
   *                                    如果未提供，则假定数组元素本身就是字符串。
   * @returns {Array<object>} - 一个新的数组，包含所有匹配的元素。每个元素是一个对象，结构如下：
   *                            `string`: 渲染后的高亮字符串。
   *                            `score`: 匹配得分。
   *                            `index`: 元素在原始输入数组中的索引。
   *                            `original`: 原始数组中的元素。
   *                            数组会根据匹配得分（降序）和原始索引（升序，用于稳定排序）进行排序。
   */
  filter(pattern, arr, opts = {}) {
    return arr
      .reduce((accumulator, element, idx) => {
        let stringToSearch = element; // 默认情况下，元素本身就是要搜索的字符串

        // 如果提供了 extract 函数，则使用它从元素中提取搜索字符串
        if (opts.extract) {
          stringToSearch = opts.extract(element);
          // 确保提取的字符串有效，处理 undefined, null 等情况
          if (!stringToSearch) {
            stringToSearch = '';
          }
        }

        // 对提取的（或原始的）字符串执行匹配
        const matchResult = this.match(pattern, stringToSearch, opts);

        // 如果找到匹配 (matchResult 不为 null)
        if (matchResult != null) {
          // 将构造好的匹配对象添加到累加器数组中
          accumulator.push({
            string: matchResult.rendered, // 高亮后的字符串
            score: matchResult.score,     // 匹配得分
            index: idx,                   // 在原数组中的索引
            original: element,            // 原始元素
          });
        }
        return accumulator; // 返回更新后的累加器
      }, []) // reduce 的初始值是一个空数组
      .sort((a, b) => { // 对结果进行排序
        // 主要按得分降序排序
        const scoreDifference = b.score - a.score;
        if (scoreDifference) return scoreDifference;
        // 如果得分相同，则按原始索引升序排序（保持稳定性）
        return a.index - b.index;
      });
  }
}

export default TributeSearch;
