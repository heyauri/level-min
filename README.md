# level-min

A light-weight full-text search library for the browser and Node.js, aimed to minimize the workload of developers in usage. Using LevelDB as storage backend.

- With a built-in text processing procedure: Tokenizer, Porter Stemmer and Stopwords filter.
- Full-text search using TF-IDF algorithm.
- Highly configurable index-schema to construct a more flexible inverted index.
- Multi-language support, including Chinese, English, Japanese, French, Itaian, Russian, Spanish, Portuguese, etc.

## Installation
```sh
$ npm install level-min
```
In general, a valid [`node-gyp`](https://github.com/nodejs/node-gyp) installation is needed.

## Quick Start

```js
const Min = require("level-min");

// Initialise level-min instance by a database address and a object that contain
const min = new Min("data",options);

// An example of how to store and index a document.
// Using such a schema, only the title and content in the value object will be indexed.
// So that those useless indexes of the value (i.e. a field of imgUrl) will not be storeed.
min.put("Document1",{
    title:"Introduction of level-min",
    content:"This is a long text. Balabala. ",
    imgUrl:"http://just-for-example.url.com/img.jpg"
},{
    key-weight:0,
    value_weight_calc:true,
    default_value_weight:0,
    value_weights: { title: 5, content: 1 }
})

min.put("example","A meaningless string.")

// In practice, the result may be affected since both put() and search are async .
// Maybe Promise.all() is a good solution.
let result = await min.search("Introduction");
```

## API

- <a href="#Min"><code><b>Min()</b> / min.<b>set_db()</b></code></a>
- <a href="#put"><code>min.<b>put()</b></code></a>
- <a href="#del"><code>min.<b>del()</b></code></a>
- <a href="#get"><code>min.<b>get()</b></code></a>
- <a href="#search"><code>min.<b>search()</b></code></a>

<a name="Min"></a>

### `Min(db_address,[options,])` / `min.set_db(db_address,[options,])`
Both of these functions will switch the leveldb instance inside `Min` to the given address.

Using as ` const min = Min(location)` is  highly recommended.

#### options(Same as the content at [leveldown#db.open](https://github.com/Level/leveldown#leveldown_open))

The optional `options` argument may contain:

- `createIfMissing` (boolean, default: `true`): If `true`, will initialise an empty database at the specified location if one doesn't already exist. If `false` and a database doesn't exist you will receive an error in your `open()` callback and your database won't open.

- `errorIfExists` (boolean, default: `false`): If `true`, you will receive an error in your `open()` callback if the database exists at the specified location.

- `compression` (boolean, default: `true`): If `true`, all _compressible_ data will be run through the Snappy compression algorithm before being stored. Snappy is very fast and shouldn't gain much speed by disabling so leave this on unless you have good reason to turn it off.

- `cacheSize` (number, default: `8 * 1024 * 1024` = 8MB): The size (in bytes) of the in-memory [LRU](http://en.wikipedia.org/wiki/Cache_algorithms#Least_Recently_Used) cache with frequently used uncompressed block contents.

**Advanced options**

The following options are for advanced performance tuning. Modify them only if you can prove actual benefit for your particular application.

- `writeBufferSize` (number, default: `4 * 1024 * 1024` = 4MB): The maximum size (in bytes) of the log (in memory and stored in the .log file on disk). Beyond this size, LevelDB will convert the log data to the first level of sorted table files. From the LevelDB documentation:

> Larger values increase performance, especially during bulk loads. Up to two write buffers may be held in memory at the same time, so you may wish to adjust this parameter to control memory usage. Also, a larger write buffer will result in a longer recovery time the next time the database is opened.

- `blockSize` (number, default `4096` = 4K): The _approximate_ size of the blocks that make up the table files. The size related to uncompressed data (hence "approximate"). Blocks are indexed in the table file and entry-lookups involve reading an entire block and parsing to discover the required entry.

- `maxOpenFiles` (number, default: `1000`): The maximum number of files that LevelDB is allowed to have open at a time. If your data store is likely to have a large working set, you may increase this value to prevent file descriptor churn. To calculate the number of files required for your working set, divide your total data by `'maxFileSize'`.

- `blockRestartInterval` (number, default: `16`): The number of entries before restarting the "delta encoding" of keys within blocks. Each "restart" point stores the full key for the entry, between restarts, the common prefix of the keys for those entries is omitted. Restarts are similar to the concept of keyframes in video encoding and are used to minimise the amount of space required to store keys. This is particularly helpful when using deep namespacing / prefixing in your keys.

- `maxFileSize` (number, default: `2* 1024 * 1024` = 2MB): The maximum amount of bytes to write to a file before switching to a new one. From the LevelDB documentation:

> ... if your filesystem is more efficient with larger files, you could consider increasing the value. The downside will be longer compactions and hence longer latency/performance hiccups. Another reason to increase this parameter might be when you are initially populating a large database.

### Notes:

Both `put()` and `del()` have used the [`db.batch()`](https://github.com/Level/leveldown#leveldown_batch) of level to keep the Atomicity inside the db's transaction. Hence, skip those functions offered by `level-min` and operate the `leveldb` directly can be dangerous.

<a name="put"></a>

### `min.put(key,value,[options,])`

<code>put()</code> is an instance method on an existing database object, used to store new entries, or overwrite existing entries in the LevelDB store. At the same time, the indexes based on the input are also generated. A promise is returned.

The `key` should be string. The value may better be `String`, `Array` or `Object`. Other object types result in an unexpected error. Keys may not be `null` or `undefined` and objects converted with `toString()` should not result in an empty-string. Values may not be `null` or `undefined`.

The optional `options` argument may contain:

- `key_weight` (Number, default: `1`): If the value of given `key_weight` is less than or equal to zero(<=0), the tokens inside the input key will not be indexed.
- `value_weight_calc` (boolean, default: `false`): If `false`, the tokens inside the value will not be counted. Switch it to `true` if it is needed.
- `default_value_weight` (Number, default: `1`): If the value of given `value_weight_calc` is `true`, its value will be calculated as the default weights of tokens inside value.
- `value_weights` (object, default: `{}`):  The values for those spec key/index when the value is an Array/Object. For example, the value is an object -> `{a:text, b:text,...}` and the `value_weights` is `{a:3}`, the tokens inside field `a` will be calculated as a token-frequency of 3, others' token-frequency will follow the `default_value_weight`.

<a name="del"></a>

### `min.del(key)`

Delete the record of key inside the db. If there are any associated indexes that are generated together before, they will be removed as well. A Promise is returned.


<a name="get"></a>

### `min.get(key)`


`get()` is the primary method for fetching data from the store. The `key` should be a String. If it doesn't exist in the store then the promise will be rejecedt. A not-found err object will be of type `'NotFoundError'` so you can `err.type == 'NotFoundError'` or you can perform a truthy test on the property `err.notFound`.

```js
min.get("example").then(info=>{
    ...
}).catch(e=>{
    if(e.type === "NotFoundError"){
        //there is no such key in the db
    }
})
```


<a name="search"></a>

### `min.search(content, [topK,])`
`search()` function will tokenize the input and then query them inside the db. If mutiple results are returned, their scores will be calculated using <b>tf-idf</b> algorithm. The top-k of the results sorted by their scores will finally be returned via promise.

```js
min.search("Shakespeare").then(results=>{
    // results in order
}).catch(e=>{
    //execption
})
```


