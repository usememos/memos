# map-obj

> Map object keys and values into a new object

## Install

```sh
npm install map-obj
```

## Usage

```js
const mapObject = require('map-obj');

const newObject = mapObject({foo: 'bar'}, (key, value) => [value, key]);
//=> {bar: 'foo'}

const newObject = mapObject({FOO: true, bAr: {bAz: true}}, (key, value) => [key.toLowerCase(), value]);
//=> {foo: true, bar: {bAz: true}}

const newObject = mapObject({FOO: true, bAr: {bAz: true}}, (key, value) => [key.toLowerCase(), value], {deep: true});
//=> {foo: true, bar: {baz: true}}

const newObject = mapObject({one: 1, two: 2}, (key, value) => value === 1 ? [key, value] : mapObject.mapObjectSkip);
//=> {one: 1}
```

## API

### mapObject(source, mapper, options?)

#### source

Type: `object`

Source object to copy properties from.

#### mapper

Type: `(sourceKey, sourceValue, source) => [targetKey, targetValue, mapperOptions?] | mapObject.mapObjectSkip`

Mapping function.

##### mapperOptions

Type: `object`

###### shouldRecurse

Type: `boolean`\
Default: `true`

Whether `targetValue` should be recursed.

Requires `deep: true`.

#### options

Type: `object`

##### deep

Type: `boolean`\
Default: `false`

Recurse nested objects and objects in arrays.

##### target

Type: `object`\
Default: `{}`

Target object to map properties on to.

### mapObject.mapObjectSkip

Return this value from a `mapper` function to exclude the key from the new object.

```js
const mapObject = require('map-obj');

const object = {one: 1, two: 2}
const mapper = (key, value) => value === 1 ? [key, value] : mapObject.mapObjectSkip
const result = mapObject(object, mapper);

console.log(result);
//=> {one: 1}
```

## Related

- [filter-obj](https://github.com/sindresorhus/filter-obj) - Filter object keys and values into a new object

---

<div align="center">
	<b>
		<a href="https://tidelift.com/subscription/pkg/npm-map-obj?utm_source=npm-map-obj&utm_medium=referral&utm_campaign=readme">Get professional support for this package with a Tidelift subscription</a>
	</b>
	<br>
	<sub>
		Tidelift helps make open source sustainable for maintainers while giving companies<br>assurances about security, maintenance, and licensing for their dependencies.
	</sub>
</div>
