export function cloneDeep<T>(value: T): T
{
	return cloneDeepCheckCircular(value, new Set());
}

export function cloneDeepNoCheck<T>(value: T): T
{
	if (typeof value !== 'object' || value === null)
		return value;

	if (Array.isArray(value))
	{
		const clone = [];

		for (let i = 0; i < value.length; i++)
			clone[i] = cloneDeepNoCheck(value[i]);

		return clone as T;
	}

	const object: Partial<T> = {};

	for (const key in value)
		object[key] = cloneDeepNoCheck(value[key]);

	return object as T;
}


function cloneDeepCheckCircular<T>(value: T, stack: Set<unknown>): T
{
	if (typeof value !== 'object')
		return value;

	if (stack.has(value))
		throw new Error('Circular value');

	stack.add(value);

	if (Array.isArray(value))
		return value.map(item => cloneDeepCheckCircular(item, new Set(stack))) as T;

	const object: Partial<T> = {};

	for (const key in value)
		object[key] = cloneDeepCheckCircular(value[key], new Set(stack));

	return object as T;
}