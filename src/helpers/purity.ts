/**
 * All type checkers and utilities of the library.
 * @module
 */



type ExtractTuple<A extends Checker[]> = {
    [K in keyof A]: CheckerType<A[K]>;
};

type CheckerOptions = {
	typeString: string;
	check: Checker['check'];
};

type CheckerType<C extends Checker> = C extends Checker<infer T> ? T : unknown;



/** Type checker class used to create type checkers
 * @example
 * ```ts
 * import { Checker } from '@purity/purity.js';
 * 
 * const $uint = new Checker<number>({
 * 	typeString: 'uint',
 * 	check(value) {
 * 		return typeof value === 'number' && value >= 0;
 * 	},
 * });
 * 
 * // TypeError: Expected 'uint' but received 'number'
 * const uint = $uint.assert(-1);
 * 
 * // Ok
 * const uint = $uint.assert(1);
 * ```
 */
class Checker<T = unknown>
{
	/**
	 * Check whether the value matches this type
	 * 
	 * @example
	 * ```ts
	 * import { $record, $string, $number } from 'purity';
	 * 
	 * const personChecker = $record({
	 * 	name: $string,
	 * 	age: $number
	 * });
	 * 
	 * if (personChecker.check(unknownValue)) {
	 * 	console.log('unknownValue matches person checker');
	 * }
	 * 
	 * // You probably want to use assert instead though:
	 * const person = personChecker.assert(unknownValue);
	 * ```
	 */
	// deno-lint-ignore no-explicit-any
	public check: (value: any) => boolean;

	/** A string representation of this wrapper's Type */
	public typeString: string;


	public constructor(options: CheckerOptions) {
		this.check = options.check;
		this.typeString = options.typeString;
	}


	/**
	 * Throws an error if the value doesn't match this type, returns typed value otherwise
	 * 
	 * @example
	 * ```ts
	 * import { $record, $string, $number } from 'purity';
	 * 
	 * const personChecker = $record({
	 * 	name: $string,
	 * 	age: $number
	 * });
	 * 
	 * const person = personChecker.assert(unknownValue);
	 * 
	 * console.log(person.name);
	 * ```
	 */
	// deno-lint-ignore no-explicit-any
	public assert(value: any): T {
		if (this.check(value)) {
			return value;
		}

		throw new CheckerError(this.typeString, Checker.getTypeString(value));
	}


	/** Returns an union of this and the wrapper passed as argument */
	// public or<Other extends Checker>(checker: Other): Checker<T | CheckerType<Other>> {
	// 	return $union(this, checker);
	// }

	/** Creates a string representation of the type of value */
	// deno-lint-ignore no-explicit-any
	public static getTypeString(value: any): string {
		const type = typeof value;

		if (type !== 'object') {
			return type;
		}

		if (value === null) {
			return 'null';
		}

		if (Array.isArray(value)) {
			return '[' + value.map(Checker.getTypeString).join(', ') + ']';
		}

		const entries = Object.entries(value);

		if (entries.length === 0) {
			return '{}';
		}

		return '{ ' + entries.map(([k, v]) => k + ': ' + Checker.getTypeString(v)).join(', ') + ' }';
	}
}

class CheckerError extends TypeError {

	public expected: string;
	public received: string;

	constructor(expected: string, received: string) {
		super(`Expected '${expected}' but received '${received}'`);
		this.expected = expected;
		this.received = received;
	}
}



const unionSeparator = ' | ';


/** Checker that always fails */
const $never: Checker<never> = new Checker<never>({
	typeString: 'never',
	check(_value) { return false },
});

/** Checker for undefined */
const $undefined: Checker<undefined> = new Checker<undefined>({
	typeString: 'undefined',
	check(value) { return typeof value === 'undefined' },
});

/** Checker for null */
const $null: Checker<null> = new Checker<null>({
	typeString: 'null',
	check(value) { return value === null },
});

/** Checker for boolean */
const $boolean: Checker<boolean> = new Checker<boolean>({
	typeString: 'boolean',
	check(value) { return typeof value === 'boolean' },
});

/** Checker for number */
const $number: Checker<number> = new Checker<number>({
	typeString: 'number',
	check(value) { return typeof value === 'number' },
});

/** Checker for string */
const $string: Checker<string> = new Checker<string>({
	typeString: 'string',
	check(value) { return typeof value === 'string' },
});

/** Checker for bigint */
const $bigint: Checker<bigint> = new Checker<bigint>({
	typeString: 'bigint',
	check(value) { return typeof value === 'bigint' },
});

/** Checker for symbol */
const $symbol: Checker<symbol> = new Checker<symbol>({
	typeString: 'symbol',
	check(value) { return typeof value === 'symbol' },
});


/** Checker factory for arrays
 * @example
 * ```ts
 * const $numbers = $array($number);
 * $numbers.assert([1, 2, '3']); // Error
 * $numbers.assert([1, 2, 3]);   // Ok
 * ```
 * @example
 * ```ts
 * const $numbersLoose = $array($number, $string);
 * $numbersLoose.assert([1, 2, '3']);       // Ok
 * $numbersLoose.assert([1, 2, '3', true]); // Error
 * ```
 */
function $array<T extends Checker[] | [Checker]>(...checkers: T): Checker<CheckerType<T[number]>[]> {

	let checker: Checker;

	switch (checkers.length) {
		case 0: checker = $never; break;
		case 1: checker = checkers[0]; break;
		default: checker = $union(...checkers); break;
	}

	const typeString = (checkers.length > 1 ? '(' + checker.typeString + ')' : checker.typeString) + '[]';

	return new Checker({

		typeString,

		check(values) {
			return Array.isArray(values) && values.every(checker.check);
		},

	});
}

/** Checker factory for objects with explicitly declared keys
 * @example
 * ```ts
 * const $person = $object({
 * 	name: $string,
 * 	age: $number
 * });
 * 
 * const person = $person.assert(...);
 * ```
 */
function $object<T extends Record<string, Checker>>(record: T): Checker<{ [K in keyof T]: CheckerType<T[K]> }> {

	const checkerEntries = Object.entries(record);
	const propertyStrings = checkerEntries.map(([key, checker]) => key + ': ' + checker.typeString);
	const typeString = '{ ' + propertyStrings.join(', ') + ' }';
  
	return new Checker({

		typeString,
		
		check(value) {

			if (typeof value !== 'object' || value === null)
				return false;

			for (const [key, checker] of checkerEntries) {
				if (!checker.check(value[key]))
					return false;
			}

			return true;
		},

	});
}

/** Similar to $object, but also fails if the value has extra properties
 * @example
 * ```ts
 * const $person = $objectStrict({
 * 	name: $string,
 * 	age: $number
 * });
 * 
 * const person = $person.assert({
 * 	name: 'John',
 * 	age: 30,
 * 	pets: 2
 * });
 * ```
 */
function $objectStrict<T extends Record<string, Checker>>(record: T): Checker<{ [K in keyof T]: CheckerType<T[K]> }> {

	const checkerEntries = Object.entries(record);
	const propertyStrings = checkerEntries.map(([key, checker]) => key + ': ' + checker.typeString);
	const typeString = '{ ' + propertyStrings.join(', ') + ' }';
  
	return new Checker({

		typeString,
		
		check(value) {

			if (typeof value !== 'object' || value === null)
				return false;

			// What makes this strict
			if (!Object.keys(value).every(key => key in record))
				return false;

			for (const [key, checker] of checkerEntries) {
				if (!checker.check(value[key]))
					return false;
			}

			return true;
		},

	});
}

/** Checker factory for objects with unknown keys
 * @example
 * ```ts
 * const $checker = $record($number);
 * 
 * // Error
 * $checker.assert({
 * 	foo: 'a',
 * 	bar: 'b'
 * });
 * 
 * // Ok
 * $checker.assert({
 * 	foo: 1,
 * 	bar: 2
 * });
 * ```
 */
function $record<T extends Checker>(valueChecker: T): Checker<Record<string, CheckerType<T>>> {
	return new Checker({

		typeString: '{ [key: string]: ' + valueChecker.typeString + ' }',
		
		check(value) {
			return (
				typeof value === 'object'
				&& value !== null
				&& Object.values(value).every(valueChecker.check)
			);
		},
  
	});
}

/**
 * Checker for literal values
 * @example
 * ```ts
 * const $color = $literal('red', 'green', 'blue');
 * $color.assert('yellow'); // Error
 * $color.assert('red');    // Ok
 * 
 * const $code = $literal(100, 200, 300, 400, 500);
 * $code.assert(600); // Error
 * $code.assert(100); // Ok
 * 
 * const $version = $literal(1, '1', 2, '2', 3, '3');
 * $version.assert(4);   // Error
 * $version.assert('3'); // Ok
 * $version.assert(1);   // Ok
 * ```
 */
function $literal<T extends (string | number)[]>(...literals: T): Checker<T[number]> {

	const typeString = literals
		.map(literal => (typeof literal === 'string' ? `"${literal}"` : literal.toString()))
		.join(' | ');

	return new Checker<T[number]>({

		typeString,

		check(value) {
			return literals.includes(value as T[number]);
		},

	});
}

/** Checker factory for union types of the type passed and undefined */
function $optional<T extends Checker>(checker: T): Checker<CheckerType<T> | undefined> {
	return new Checker({

		typeString: checker.typeString + unionSeparator + $undefined.typeString,

		check(value) {
			return $undefined.check(value) || checker.check(value);
		},

	});
}

/** Checker factory for union types of the type passed and null */
function $nullable<T extends Checker>(checker: T): Checker<CheckerType<T> | null> {
	return new Checker({

		typeString: checker.typeString + unionSeparator + $null.typeString,

		check(value) {
			return $null.check(value) || checker.check(value)
		},

	});
}

/** Checker factory for tuples
 * @example
 * const $keyValuePair = $tuple($string, $number);
 * $keyValuePair.assert([1000]);                // Error
 * $keyValuePair.assert(['score']);             // Error
 * $keyValuePair.assert([1000, 'score']);       // Error
 * $keyValuePair.assert(['score', 1000, true]); // Error
 * $keyValuePair.assert(['score', 1000]);       // Ok
 */
function $tuple<T extends Checker[]>(...checkers: T): Checker<ExtractTuple<T>> {
	return new Checker({

		typeString: '[' + checkers.map(Type => Type.typeString).join(', ') + ']',

		check(value) {
			return (
				Array.isArray(value)
				&& value.length === checkers.length
				&& checkers.every((Type, i) => Type.check(value[i]))
			);
		},

	});
}

/** Checker factory for tuples
 * @example
 * const $textOrNum = $union($string, $number);
 * $textOrNum.assert(true);    // Error
 * $textOrNum.assert('hello'); // Ok
 * $textOrNum.assert(1000);    // Ok
 */
function $union<T extends Checker[]>(...checkers: T): Checker<CheckerType<T[number]>> {
	return new Checker({

		typeString: checkers.map(type => type.typeString).join(unionSeparator),

		check(value) {
			return checkers.some(type => type.check(value));
		},

	});
}



export {
	Checker,
	type CheckerType,

	$never,
	$undefined,
	$null,
	$boolean,
	$number,
	$string,
	$bigint,
	$symbol,

	$array,
	$object,
	$objectStrict,
	$record,

	$literal,
	$optional,
	$nullable,
	$tuple,
	$union,
};