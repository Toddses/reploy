/**
 * Server Configuration
 */

// Requires
var async = require('async'),
	Client = require('ssh2').Client;

// Constructor
var Server = function (opts, logger, cb) {

	this.logger   = logger;
	this.client   = '';
	this.cmdQueue = [];

	this.host     = opts.host;
	this.port     = opts.port || 22;
	this.user     = opts.username;
	this.pass     = opts.password || '';
	this.agent    = opts.agent || '';
	this.agentFwd = opts.agentFwd || false;
	
};

// Open up a connection and prepare to blast it with commands
Server.prototype.open = function (cb) {

	this.client = new Client();

	this.client.connect({
		host: this.host,
		port: this.port,
		username: this.user,
		password: this.pass,
		agent: this.agent,
		agentForward: this.agentFwd,
		readyTimeout: 5000
	});

	this.client.on('ready', function () {
		cb();
	});

	this.client.on('error', function (err) {
		cb(err.toString());
	});

};

// Close down a connection after blasting it with commands
Server.prototype.close = function (cb) {

	this.client.end();
	cb();

};

// Open up a connection
// TODO Refactor so we aren't using simple-ssh, but ssh2 instead
// FUCK IT JUST DEPRECATE THIS
Server.prototype._open = function (cb) {

	var that = this;

	var ssh = new SSH({
		host: this.host,
		user: this.user,
		agent: process.env.SSH_AUTH_SOCK,
		agentForward: true,
	});

	ssh.on('error', function (err) {
		ssh.end();
		cb(err);
	});

	ssh.on('close', function () {
		that.cmdQueue.length = 0;
		cb();
	});

	return ssh;

};

// Add a command to the queue
Server.prototype.queue = function (cmd, cwd) {

	this.cmdQueue.push(this._parseCommand(cmd, cwd));
	return this;

};

// Execute one command and return the output
// DEPRECATED
Server.prototype.exec = function (cmd, cwd, cb) {

	if (!cb && typeof cwd === 'function') {
		cb  = cwd;
		cwd = '';
	}

	var that = this,
		ssh = this._open(function() {});

	cmd = this._parseCommand(cmd, cwd);

	ssh.exec(cmd, {
		err: function (stderr) {
			that.logger.error(stderr);
		},
		out: function (stdout) {
			cb(stdout.replace(/\n$/, ''));
		},
		exit: function (code) {
			that.logger.verbose('Command exit >> code: ' + code + ', command: ' + cmd);
			if (code != 0) {
				cb(code);
			}
		}
	}).start();

};

// Check if a file or directory exists
Server.prototype.check = function (type, path, cb) {

	var flag = type == 'file' ? '-f' : '-d';
	var cmd = 'if test ' + flag + ' ' + path + '; then echo 1; else echo 0; fi';

	this.logger.verbose('Executing command: ' + cmd);

	this.client.exec(cmd, function (err, stream) {
		if (err) throw err;

		stream.on('data', function (data) {
			cb(data.toString().replace(/\n$/, ''));
		}).stderr.on('data', function (data) {
			cb(null, data.toString().replace(/\n$/, ''));
		});
	});

};

// Execute a command and return the data
Server.prototype.capture = function (cmd, cwd, cb) {

	if (!cb && typeof cwd === 'function') {
		cb  = cwd;
		cwd = '';
	}

	cmd = this._parseCommand(cmd, cwd);

	this.client.exec(cmd, function (err, stream) {
		if (err) throw err;

		stream.on('data', function (data) {
			cb(data.toString().replace(/\n$/, ''));
		}).stderr.on('data', function (data) {
			cb(null, data.toString().replace(/\n$/, ''));
		});
	});

};

// Execute the command queue
// TODO Remove commands from the array as they are executed
Server.prototype.execQueue = function (cb) {

	var that = this;

	async.whilst(
		function () { return that.cmdQueue.length > 0; },

		function (callback) {
			var cmd = that.cmdQueue.shift();

			that.logger.verbose('Executing command: ' + cmd);

			that.client.exec(cmd, function (err, stream) {
				if (err) throw err;

				stream.on('data', function (data) {
					//console.log(data.toString().replace(/\n$/, ''));

				}).stderr.on('data', function (data) {
					callback(data.toString().replace(/\n$/, ''));

				}).on('close', function () {
					callback();
				});
			});
		},

		function (err) {
			if (err) cb(err);
			else cb();
		});

};

// Parse the command array
Server.prototype._parseCommand = function (cmd, cwd) {

	var cmdString = '';

	if (cwd) {
		cmdString = 'cd ' + cwd + ' && ';
	}

	if (Array.isArray(cmd)) {
		cmd.forEach(function (arg) {
			cmdString += arg + ' ';
		});
	} else {
		cmdString += cmd;
	}

	return cmdString;

};

Server.prototype.test = function (cb) {

};

Server.prototype.testSSH2 = function (cb) {

	var client = new Client();

	client.on('ready', function() {
	    console.log("Client :: ready");

	    /*client.exec('git ls-remote --heads git@github.com:Toddses/capify-press.git', function (err, stream) {
	        if (err) throw err;

	        stream.on('close', function (code, signal) {
	            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
	            //client.end();
	            //cb();
	        }).on('data', function (data) {
	            console.log('STDOUT: ' + data);
	        }).stderr.on('data', function (data) {
	            console.log('STDERR: ' + data);
	        });
	    });*/
	    client.exec('[ -f blah.txt ]', function (err, stream) {
	        if (err) throw err;

	        stream.on('close', function (code, signal) {
	            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
	            client.end();
	            cb();
	        }).on('data', function (data) {
	            console.log('STDOUT: ' + data);
	        }).stderr.on('data', function (data) {
	            console.log('STDERR: ' + data);
	        });
	    });
	}).connect({
	    host: this.host,
	    port: 22,
	    user: this.user,
	    agent: process.env.SSH_AUTH_SOCK,
	    agentForward: true
	});

};

// Test SSH2 functionality
Server.prototype.testSSH2Async = function (cb) {
	
	var client = new Client();

	client.connect({
		host: this.host,
		port: 22,
		user: this.user,
		agent: process.env.SSH_AUTH_SOCK,
		agentForward: true
	});

	client.on('ready', function() {
		console.log("Client :: ready");

		async.series([
			function (callback) {
				client.exec('git ls-remote --heads git@github.com:Toddses/capify-press.git', function (err, stream) {
					if (err) throw err;

					stream.on('close', function (code, signal) {
						console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
						callback();
					}).on('data', function (data) {
						console.log('STDOUT:\n' + data);
					}).stderr.on('data', function (data) {
						console.log('STDERR: ' + data);
					});
				});
			},
			function (callback) {
				client.exec('git clone --mirror git@github.com:Toddses/capify-press.git /var/www/html/tester', function (err, stream) {
					if (err) throw err;

					stream.on('close', function (code, signal) {
						console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
						callback();
					}).on('data', function (data) {
						console.log('STDOUT:\n' + data);
					}).stderr.on('data', function (data) {
						console.log('STDERR: ' + data);
					});
				});
			}
		],
		function () {
			console.log('Client :: disconnect');
			client.end();
			cb();
		});
	});

};

// test simple-ssh
// DEPRECATED
Server.prototype.testSimpleSSH = function (cb) {
	var that = this,
		ssh = this._open(cb);

		ssh.exec('ls -la', {
			err: function (stderr) {
				that.logger.error(stderr);
			},
			out: function (stdout) {
				that.logger.log(stdout.replace(/\n$/, ''));
			},
			exit: function (code) {
				that.logger.verbose('Command exit >> code: ' + code + ', command: ls -la');
			}
		});
		ssh.exec('git ls-remote git@github.com:Toddses/capify-press.git', {
			err: function (stderr) {
				that.logger.error(stderr);
			},
			out: function (stdout) {
				that.logger.log(stdout.replace(/\n$/, ''));
			},
			exit: function (code) {
				that.logger.verbose('Command exit >> code: ' + code + ', command: git ls-remote git@github.com/Toddses/capify-press.git');
			}
		});

	ssh.start();

};

module.exports = Server;