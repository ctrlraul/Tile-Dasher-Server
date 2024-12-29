function range(start: number, count: number): number[]
{
	return Array.from({ length: count }, (_, i) => start + i);
}

export const ArrayHelper = {
	range,
};