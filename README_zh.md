# level-min

一个针对Node.js的轻量级全文搜索库，旨在最小化开发人员的工作量。使用LevelDB作为存储后端。

[![npm](https://img.shields.io/npm/v/level-min.svg?label=&logo=npm)](https://www.npmjs.com/package/level-min)
[![Node version](https://img.shields.io/node/v/level-min.svg)](https://www.npmjs.com/package/level-min)


- 具有内置的文本处理过程：标记器、波特词干分析器和Stopwords过滤器。
- 使用TF-IDF算法进行全文搜索。
- 高度可配置的索引模式，以构建更灵活的反向索引。
- 支持多种语言，包括中文、英语、日语、法语、意大利语、俄语、西班牙语、葡萄牙语等。

## 安装
```sh
$ npm install level-min
```
In general, a valid [`node-gyp`](https://github.com/nodejs/node-gyp) installation is needed.

## Quick Start

```js
const Min = require("level-min");

// 初始化level-min实例
const min = new Min();

// 设置数据库地址和选项
await min.initializeDatabase("data", options);

// An example of how to store and index a document.
// Using such a schema, only the title and content in the value object will be indexed.
// 这样，值对象中的无用索引（如imgUrl字段）将不会被存储。
min.put("Document1",{
    title:"Introduction of level-min",
    content:"This is a long text. Balabala. ",
    imgUrl:"http://just-for-example.url.com/img.jpg"
},{
    keyWeight:0,
    valueWeightCalc:true,
    defaultValueWeight:0,
    valueWeights: { title: 5, content: 1 }
})

min.put("example", "一个无意义的字符串。");

// 在实际应用中，由于put()和search()都是异步的，结果可能会受到影响。
// 建议使用Promise.all()或async/await来确保正确的执行顺序。
let result = await min.search("Introduction");
```

## API

- <a href="#Min"><code><b>Min()</b> / min.<b>initializeDatabase()</b></code></a>
- <a href="#put"><code>min.<b>put()</b></code></a>
- <a href="#del"><code>min.<b>del()</b></code></a>
- <a href="#get"><code>min.<b>get()</b></code></a>
- <a href="#search"><code>min.<b>search()</b></code></a>

<a name="Min"></a>

### `Min()` / `min.initializeDatabase(dbAddress, [options])`
`Min()`创建一个新的level-min实例，无需任何参数。使用`min.initializeDatabase(dbAddress, [options])`来初始化数据库连接。

推荐用法：
```js
const min = new Min();
await min.initializeDatabase("data", options);
```

#### options(Same as the content at [leveldown#db.open](https://github.com/Level/leveldown#leveldown_open))

可选的`options`参数包含：

- `createIfMissing` (布尔值，默认: `true`): 如果为`true`，当指定位置没有数据库时，将初始化一个空数据库。如果为`false`且数据库不存在，您将在`open()`回调中收到错误，数据库将不会打开。

- `errorIfExists` (布尔值，默认: `false`): 如果为`true`，当指定位置已存在数据库时，您将在`open()`回调中收到错误。

- `compression` (布尔值，默认: `true`): 如果为`true`，所有可压缩的数据将在存储前通过Snappy压缩算法处理。Snappy非常快，禁用它不会获得太多速度提升，因此除非有充分理由，否则请保持开启。

- `cacheSize` (数字，默认: `8 * 1024 * 1024` = 8MB): 内存中[LRU](http://en.wikipedia.org/wiki/Cache_algorithms#Least_Recently_Used)缓存的大小（字节），用于存储频繁使用的未压缩块内容。

**高级选项**

以下选项用于高级性能调优。只有在能够证明对您的特定应用程序有实际好处时才修改它们。

- `writeBufferSize` (数字，默认: `4 * 1024 * 1024` = 4MB): 日志的最大大小（字节）（内存中并存储在磁盘的.log文件中）。超过此大小，LevelDB将把日志数据转换为第一级排序表文件。根据LevelDB文档：

> 较大的值会提高性能，特别是在批量加载期间。最多可以在内存中同时保留两个写入缓冲区，因此您可能希望调整此参数以控制内存使用。此外，较大的写入缓冲区将导致下次打开数据库时更长的恢复时间。

- `blockSize` (数字，默认 `4096` = 4K): 构成表文件的块的近似大小。大小与未压缩数据相关（因此是"近似"）。块在表文件中建立索引，条目查找涉及读取整个块并解析以发现所需的条目。

- `maxOpenFiles` (数字，默认: `1000`): LevelDB一次允许打开的最大文件数。如果您的数据存储可能有很大的工作集，您可以增加此值以防止文件描述符频繁切换。要计算工作集所需的文件数，请将您的总数据除以`'maxFileSize'`。

- `blockRestartInterval` (数字，默认: `16`): 在重新启动块内键的"增量编码"之前的条目数。每个"重新启动"点存储条目的完整键，在重新启动之间，这些条目的键的公共前缀被省略。重新启动类似于视频编码中的关键帧概念，用于最小化存储键所需的空间。这在键中使用深度命名空间/前缀时特别有用。

- `maxFileSize` (number, default: `2* 1024 * 1024` = 2MB): The maximum amount of bytes to write to a file before switching to a new one. From the LevelDB documentation:

> ...如果您的文件系统对较大文件更有效，您可以考虑增加该值。缺点将是更长的压缩时间，从而导致更长的延迟/性能波动。增加此参数的另一个原因可能是当您最初填充大型数据库时。

### Notes:

`put()`和`del()`都使用了level的[`db.batch()`](https://github.com/Level/leveldown#leveldown_batch)来保持数据库事务中的原子性。因此，跳过`level-min`提供的函数直接操作`leveldb`可能是危险的。

<a name="put"></a>

### `min.put(key,value,[options,])`

<code>put()</code>是现有数据库对象上的实例方法，用于在LevelDB存储中存储新条目或覆盖现有条目。同时，基于输入的索引也会被生成。返回一个Promise。

`key`应该是字符串。`value`最好是`String`、`Array`或`Object`。其他对象类型可能导致意外错误。键不能为`null`或`undefined`，通过`toString()`转换的对象不应产生空字符串。值不能为`null`或`undefined`。

The optional `options` argument may contain:

- `keyWeight` (数字，默认: `1`): 如果给定的`keyWeight`值小于或等于零(<=0)，输入键中的token将不会被索引。
- `valueWeightCalc` (布尔值，默认: `false`): 如果为`false`，值中的token将不会被计算。如果需要，请将其切换为`true`。
- `defaultValueWeight` (数字，默认: `1`): 如果给定的`valueWeightCalc`值为`true`，其值将作为值中token的默认权重进行计算。
- `valueWeights` (对象，默认: `{}`): 当值是数组/对象时，特定键/索引的权重值。例如，值是一个对象`{a:text, b:text,...}`，而`valueWeights`是`{a:3}`，字段`a`中的token将计算为3的token频率，其他token频率将遵循`defaultValueWeight`。

<a name="del"></a>

### `min.del(key)`

删除数据库中键的记录。如果有任何之前一起生成的关联索引，它们也将被删除。返回一个Promise。


<a name="get"></a>

### `min.get(key)`


`get()`是从存储中获取数据的主要方法。`key`应该是字符串。如果它在存储中不存在，则promise将被拒绝。未找到的错误对象类型为`'NotFoundError'`，因此您可以使用`err.type == 'NotFoundError'`或对属性`err.notFound`进行真值测试。

```js
min.get("example").then(info=>{
    ...
}).catch(e=>{
    if (e.type === "NotFoundError") {
    // 数据库中没有这样的键
}
})
```


<a name="search"></a>

### `min.search(content, [options])`
`search()`函数将对输入进行分词，然后在数据库中查询它们。如果返回多个结果，将使用<b>TF-IDF</b>算法和<b>余弦相似度</b>计算它们的分数。按分数降序排列的前k个结果最终将通过promise返回。

```js
min.search("Shakespeare").then(results => {
    // 结果按顺序返回
}).catch(error => {
    // 处理异常
})
```

在后续版本中，余弦相似度功能正在计划中。


<a name="textProcessProcedure"></a>

## About the Text Processing Procedure

The built-in text processing procedures in `level-min` including Tokenizer, Porter Stemmer and Stopwords filter that are offered by various npm libraries.

As a result of the multi-language supporting, there are many versions of those integrated tokenizers, stemmers and stopwords filter since they are from different packages.

In practice, which lib will be used in a specific input is more likely to depend on the language-detect packages. Hence, the indexes generated by the text processing procedure may be slightly different than what is being indexed.

To solve this issue, a configurable language preference is now on the develop plan.

However, you can still use this package freely cause this problem just affects the performances not the accuracies.







