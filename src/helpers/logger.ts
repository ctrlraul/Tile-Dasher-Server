import chalk from 'chalk';

const Level = {
	Trace: chalk.blue('Trace'),
	Debug: chalk.cyan('Debug'),
	Info: chalk.green('Info'),
	Warn: chalk.yellow('Warn'),
	Error: chalk.red('Error'),
	Critical: chalk.bgRed('Critical'),
};

export class Logger
{
	private label: string;


	constructor(label: string)
	{
		this.label = label;
	}


	public info(...message: unknown[]): void
	{
		Logger.info(`[${chalk.blue(this.label)}]`, ...message);
	}

	public warn(...message: unknown[]): void
	{
		Logger.warn(`[${chalk.blue(this.label)}]`, ...message);
	}

	public error(...message: unknown[]): void
	{
		Logger.error(`[${chalk.blue(this.label)}]`, ...message);
	}


	public static info(...message: unknown[]): void
	{
		Logger.log(Level.Info, ...message);
	}

	public static warn(...message: unknown[]): void
	{
		Logger.log(Level.Warn, ...message);
	}

	public static error(...message: unknown[]): void
	{
		Logger.log(Level.Error, ...message);
	}


	private static log(level: string, ...message: unknown[]): void
	{
		console.log(chalk.grey(Logger.getCurrentTime()), `[${level}]`, ...message);
	}


	private static getCurrentTime(): string
	{
		const now = new Date();
		const hours = now.getHours().toString().padStart(2, '0');
		const minutes = now.getMinutes().toString().padStart(2, '0');
		const seconds = now.getSeconds().toString().padStart(2, '0');
		const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
		return `${hours}:${minutes}:${seconds}.${milliseconds}`;
	}
}