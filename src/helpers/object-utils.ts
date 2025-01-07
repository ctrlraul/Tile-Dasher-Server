type CountFn<T extends {}> = (entry: [string, T[keyof T]], index: number) => boolean;

function count<T extends {}>(object: T, countFn?: CountFn<T>): number
{
	if (countFn === undefined)
		return Object.keys(object).length;

	return Object.entries(object)
		.map((entry, index) => countFn(entry as any, index))
		.length;
}

export const ObjectUtils = {
	count,
};