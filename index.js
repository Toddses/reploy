var fs       = require('fs'),
	Deployer = require('./lib/deployer');

function Reploy() {
	// don't do nothing right now
};

// setup, prepare for launch
Reploy.prototype.init = function (templateDir, logger) {

	var that = this;
	this.logger = logger;

	// copy the reploy.json template file to the cwd
	fs.readFile(templateDir + '/reploy.json.tmpl', function (err, data) {
		if (err) that.logger.error('unable to locate reploy.json template');
		else {
			fs.writeFile('./reploy.json', data, { flag: 'wx' }, function (err) {
				if (err) {
					if (err.code === 'EEXIST')
						that.logger.error('reploy.json already exists!');
					else
						that.logger.error(err);
				} else
					that.logger.log('created reploy.json')
			});
		}
	});

};

// instantiate the deployer
Reploy.prototype.setStage = function (stage) {
	this._deployer = new Deployer(stage, this.logger);
};

// execute the deploy task
Reploy.prototype.deploy = function () {
	this._deployer.deploy();
};

var inst = new Reploy();
module.exports = inst;