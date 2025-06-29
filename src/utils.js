// src/utils.js

// Polyfill for Array.prototype.find
// 检查 Array.prototype 上是否已存在 find 方法，如果不存在，则定义它。
// 这是为了确保在不支持 ES6 Array.prototype.find 的旧版浏览器中代码也能正常运行。
if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, 'find', {
    value: function(predicate) {
      // 1. 让 O 成为 ? ToObject(this 值)。
      if (this == null) { // 检查 this 是否为 null 或 undefined
        throw new TypeError('"this" is null or not defined'); // 如果是，则抛出 TypeError
      }

      var o = Object(this); // 将 this 转换为对象

      // 2. 让 len 成为 ? ToLength(? Get(O, "length"))。
      var len = o.length >>> 0; // 获取对象的长度，并确保它是一个无符号整数

      // 3. 如果 IsCallable(predicate) 为 false，则抛出 TypeError 异常。
      if (typeof predicate !== 'function') { // 检查 predicate 是否为函数
        throw new TypeError('predicate must be a function'); // 如果不是，则抛出 TypeError
      }

      // 4. 如果提供了 thisArg，则让 T 成为 thisArg；否则让 T 成为 undefined。
      var thisArg = arguments[1]; // 获取传递给 find 方法的第二个参数作为 thisArg

      // 5. 让 k 成为 0。
      var k = 0; // 初始化索引 k 为 0

      // 6. 重复，当 k < len 时
      while (k < len) {
        // a. 让 Pk 成为 ! ToString(k)。
        // b. 让 kValue 成为 ? Get(O, Pk)。
        var kValue = o[k]; // 获取数组中索引为 k 的值
        // c. 让 testResult 成为 ToBoolean(? Call(predicate, T, « kValue, k, O »))。
        // d. 如果 testResult 为 true，则返回 kValue。
        if (predicate.call(thisArg, kValue, k, o)) { // 使用 thisArg 作为上下文调用 predicate 函数
          return kValue; // 如果 predicate 返回 true，则返回当前值
        }
        // e. 将 k 增加 1。
        k++;
      }

      // 7. 返回 undefined。
      return undefined; // 如果循环结束仍未找到满足条件的元素，则返回 undefined
    },
    configurable: true, // 允许后续修改或删除此属性
    writable: true      // 允许后续通过赋值操作修改此属性的值
  });
}

// Polyfill for window.CustomEvent
// 检查 window 对象是否存在 (即代码是否在浏览器环境中运行)
// 并且 window.CustomEvent 是否不是一个函数 (即浏览器本身未实现或实现不符合标准 CustomEvent 构造函数)
// 这主要针对旧版浏览器，特别是 IE。
if (typeof window !== 'undefined' && typeof window.CustomEvent !== "function") {
  // 定义一个名为 CustomEvent 的函数，它模拟标准的 CustomEvent 构造函数行为
  function CustomEvent(event, params) {
    // 初始化事件参数，如果未提供则使用默认值
    params = params || {
      bubbles: false,    // 事件是否应该冒泡
      cancelable: false, // 事件是否可以被取消
      detail: undefined  // 事件的附加信息
    };
    // 使用 document.createEvent('CustomEvent') 创建一个 CustomEvent 对象
    // 注意：在某些非常旧的浏览器中，'CustomEvent' 可能不被支持，此时 createEvent('Event') 可能更通用，
    // 但标准的 CustomEvent polyfill 通常会尝试创建 'CustomEvent'。
    var evt = document.createEvent('CustomEvent');
    // 初始化创建的事件对象
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt; // 返回创建并初始化的事件对象
  }

  // 如果宿主环境存在 window.Event (通常是这种情况)，
  // 则将我们模拟的 CustomEvent 的原型设置为 window.Event.prototype。
  // 这是为了尝试使模拟的 CustomEvent 实例能够通过 `instanceof Event` 的检查，
  // 并继承 Event 原型上的属性和方法。
  if (typeof window.Event !== 'undefined') {
    CustomEvent.prototype = window.Event.prototype;
  }

  // 将我们定义的 CustomEvent 函数赋给 window.CustomEvent，
  // 从而在全局作用域中提供这个 polyfill。
  window.CustomEvent = CustomEvent;
}
