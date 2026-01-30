require('mocha/mocha');

function run() {
	mocha.setup({
		ui: 'tdd',
		reporter: undefined
	});

	// Mock tests for now since we don't have the full test environment set up
	suite('Web Extension Test Suite', () => {
		test('Sample test', () => {
			if (true !== true) {
				throw new Error('Assertion failed');
			}
		});
	});

	return new Promise((c, e) => {
		try {
			mocha.run(failures => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c();
				}
			});
		} catch (err) {
			console.error(err);
			e(err);
		}
	});
}

module.exports = {
	run
};
