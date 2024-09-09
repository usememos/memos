# snakecase-keys [![tests](https://github.com/bendrucker/snakecase-keys/workflows/tests/badge.svg)](https://github.com/bendrucker/snakecase-keys/actions?query=workflow%3Atests)

> Convert an object's keys to snake case


## Install

```
$ npm install --save snakecase-keys
```


## Usage

```js
var snakecaseKeys = require('snakecase-keys')

snakecaseKeys({fooBar: 'baz'})
//=> {foo_bar: 'baz'}

snakecaseKeys({'foo-bar': true, nested: {fooBaz: 'bar'}});
//=> {foo_bar: true, nested: {foo_baz: 'bar'}}
```

## API

#### `snakecaseKeys(obj, options)` -> `object`

##### obj

*Required*  
Type: `object`

An object to transform into snake case (keys only).

##### options

*Optional*  
Type: `object`

###### deep

Type: `boolean`  
Default: `true`

Enables snake-casing of keys in nested objects.

###### exclude

Type: `array[string || regexp]`  
Default: `[]`

An array of strings or regular expressions matching keys that will be excluded from snake-casing.

## Related

* [camelcase-keys](https://github.com/sindresorhus/camelcase-keys)
* [kebabcase-keys](https://github.com/mattiloh/kebabcase-keys)

## License

MIT © [Ben Drucker](http://bendrucker.me)
