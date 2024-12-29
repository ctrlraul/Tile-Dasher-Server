export class Logger
{
	private label: string;

	constructor(label: string)
	{
		this.label = label;
	}

	public log(...message: unknown[]): void
	{
		console.log(`[${this.label}]`, ...message);
	}
}