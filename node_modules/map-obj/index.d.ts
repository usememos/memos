// Unique symbol cannot be declared in a namespace directly, so we declare it top-level
// See: https://github.com/sindresorhus/map-obj/pull/38#discussion_r702396878
declare const skipSymbol: unique symbol;

declare namespace mapObject {
	type Mapper<
		SourceObjectType extends {[key: string]: any},
		MappedObjectKeyType extends string,
		MappedObjectValueType
	> = (
		sourceKey: keyof SourceObjectType,
		sourceValue: SourceObjectType[keyof SourceObjectType],
		source: SourceObjectType
	) => [
		targetKey: MappedObjectKeyType,
		targetValue: MappedObjectValueType,
		mapperOptions?: mapObject.MapperOptions
	] | typeof mapObject.mapObjectSkip;

	interface Options {
		/**
		Recurse nested objects and objects in arrays.

		@default false
		*/
		deep?: boolean;

		/**
		Target object to map properties on to.

		@default {}
		*/
		target?: {[key: string]: any};
	}

	interface DeepOptions extends Options {
		deep: true;
	}

	interface TargetOptions<TargetObjectType extends {[key: string]: any}> extends Options {
		target: TargetObjectType;
	}

	interface MapperOptions {
		/**
		Whether `targetValue` should be recursed.

		Requires `deep: true`.

		@default true
		*/
		readonly shouldRecurse?: boolean;
	}

	/**
	Return this value from a `mapper` function to remove a key from an object.

	@example
	```
	const mapObject = require('map-obj');

	const object = {one: 1, two: 2}
	const mapper = (key, value) => value === 1 ? [key, value] : mapObject.mapObjectSkip
	const result = mapObject(object, mapper);

	console.log(result);
	//=> {one: 1}
	```
	*/
	const mapObjectSkip: typeof skipSymbol
}

/**
Map object keys and values into a new object.

@param source - Source object to copy properties from.
@param mapper - Mapping function.

@example
```
import mapObject = require('map-obj');

const newObject = mapObject({foo: 'bar'}, (key, value) => [value, key]);
//=> {bar: 'foo'}

const newObject = mapObject({FOO: true, bAr: {bAz: true}}, (key, value) => [key.toLowerCase(), value]);
//=> {foo: true, bar: {bAz: true}}

const newObject = mapObject({FOO: true, bAr: {bAz: true}}, (key, value) => [key.toLowerCase(), value], {deep: true});
//=> {foo: true, bar: {baz: true}}

const newObject = mapObject({one: 1, two: 2}, (key, value) => value === 1 ? [key, value] : mapObject.mapObjectSkip);
//=> {one: 1}
```
*/
declare function mapObject<
	SourceObjectType extends object,
	TargetObjectType extends {[key: string]: any},
	MappedObjectKeyType extends string,
	MappedObjectValueType
>(
	source: SourceObjectType,
	mapper: mapObject.Mapper<
		SourceObjectType,
		MappedObjectKeyType,
		MappedObjectValueType
	>,
	options: mapObject.DeepOptions & mapObject.TargetOptions<TargetObjectType>
): TargetObjectType & {[key: string]: unknown};
declare function mapObject<
	SourceObjectType extends object,
	MappedObjectKeyType extends string,
	MappedObjectValueType
>(
	source: SourceObjectType,
	mapper: mapObject.Mapper<
		SourceObjectType,
		MappedObjectKeyType,
		MappedObjectValueType
	>,
	options: mapObject.DeepOptions
): {[key: string]: unknown};
declare function mapObject<
	SourceObjectType extends {[key: string]: any},
	TargetObjectType extends {[key: string]: any},
	MappedObjectKeyType extends string,
	MappedObjectValueType
>(
	source: SourceObjectType,
	mapper: mapObject.Mapper<
		SourceObjectType,
		MappedObjectKeyType,
		MappedObjectValueType
	>,
	options: mapObject.TargetOptions<TargetObjectType>
): TargetObjectType & {[K in MappedObjectKeyType]: MappedObjectValueType};
declare function mapObject<
	SourceObjectType extends {[key: string]: any},
	MappedObjectKeyType extends string,
	MappedObjectValueType
>(
	source: SourceObjectType,
	mapper: mapObject.Mapper<
		SourceObjectType,
		MappedObjectKeyType,
		MappedObjectValueType
	>,
	options?: mapObject.Options
): {[K in MappedObjectKeyType]: MappedObjectValueType};

export = mapObject;
