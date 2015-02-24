#!/usr/bin/env node

// Requirements
var fs        = require('fs'),
	chalk     = require('chalk'),
	argv      = require('minimist')(process.argv.slice(2)),
	semver    = require('semver'),
	interpret = require('interpret'),
	Liftoff   = require('liftoff'),
	Deployer  = require('../lib/deployer'),
	Logger    = require('../lib/logger');

// set env var for ORIGINAL cwd before anything touches it
process.env.INIT_CWD = process.cwd();

// prepare the cli with Liftoff!
var cli = new Liftoff({
	name: 'reploy',
	extensions: interpret.jsVariants
});

// setup 
var cliPackage  = require('../package');
var versionFlag = argv.v || argv.version;
var tasks       = argv._;
var task        = tasks[0];
var stage       = tasks[1];
var logLevel    = 'success';

if (argv.verbose) {
	logLevel = 'verbose';
}

var logger = new Logger({ level: logLevel });

cli.on('require', function (name) {
  	logger.log('Requiring external module');
});

cli.on('requireFail', function (name) {
	logger.error('Failed to load external module ' + name);
});

cli.on('respawn', function (flags, child) {
	var nodeFlags = flags.join(', ');
	var pid = child.pid;
	gutil.log('Node flags detected: ' + nodeFlags);
	gutil.log('Respawned to PID: ' + pid);
});

cli.launch({
	cwd: argv.cwd,
	configPath: argv.gulpfile,
	require: argv.require
	//completion: argv.completion
}, handleArguments);

// the actual logic
function handleArguments(env) {
	if (versionFlag) {
		logger.log('CLI version ' + cliPackage.version);
		if (env.modulePackage && typeof env.modulePackage.version !== 'undefined') {
			logger.log('Local version ' + env.modulePackage.version);
		}
		process.exit(0);
	}

	if (!env.modulePath) {
		logger.error('Local reploy not found in ' + env.cwd);
		logger.error('Try running: npm install reploy')
		process.exit(1);
	}

	// check for semver difference between cli and local installation
	if (semver.gt(cliPackage.version, env.modulePackage.version)) {
		logger.warn('reploy version mismatch');
		logger.warn('CLI reploy is ' + cliPackage.version);
		logger.warn('Local reploy is ' + env.modulePackage.version);
	}

	// reployfile is not required, so just inform the user we aren't using one
	if (!env.configPath && task !== 'init') {
		logger.warn('No reployfile found. Proceeding without reployfile.');
	}

	// chdir before requiring gulpfile to make sure
	// we let them chdir as needed
	if (process.cwd() !== env.cwd) {
		process.chdir(env.cwd);
		logger.log('Working directory changed to ' + env.cwd);
	}

	// this is what actually loads up the reployfile
	if (env.configPath && task !== 'init') {
		require(env.configPath);
		logger.log('Using reployfile ' + env.configPath);
	}

	var reployInst = require(env.modulePath),
		templateDir = env.cwd + '/node_modules/reploy/templates';

	process.nextTick(function () {
		if (task === 'init') {
			reployInst.init(templateDir, logger);
		} else {
			reployInst.setStage(stage);
			//execute the deployment task
			logger.log('deploy to ' + stage);
		}
	});
}
