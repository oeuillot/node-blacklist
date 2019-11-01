import Commander from 'commander';
import u from 'url';
import Blacklist from "./src/Blacklist.mjs";

const program = new Commander.Command();

program.command("test <url>").action(async (url) => {
	console.log('test url=', url);

	const blackList = new Blacklist();
	blackList.setCwdDbPath();

	const result = await blackList.process(new u.URL(url));

	console.log('Result=', result);
});

program.parse(process.argv);
