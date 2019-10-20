import {Session} from 'inspector';

export function get(cb) {
	// Open a session with the Node.js V8 Inspector. See:
	//  - https://nodejs.org/api/inspector.html#inspector_class_inspector_session
	//  - https://chromedevtools.github.io/devtools-protocol/v8/Runtime
	const session = new Session();
	session.connect();

	session.post('Runtime.evaluate', {
		expression: 'Promise.prototype'
	}, (err, params) => {
		if (err) {
			session.disconnect()
			return cb(err);
		}

		session.post('Runtime.queryObjects', {
			prototypeObjectId: params.result.objectId
		}, (err, params) => {
			if (err) {
				session.disconnect()
				return cb(err)
			}

			session.post('Runtime.getProperties', {
				objectId: params.objects.objectId,
				ownProperties: true // Return properties for this object, not its prototype chain.
			}, (err, params) => {
				if (err) {
					session.disconnect()
					return cb(err)
				}

				const elements = params.result.filter(p => !!p.enumerable)
				const pendingPromises = []

				const loop = () => {
					if (elements.length === 0) {
            // done!
						return cb(null, pendingPromises)
					}

					const element = elements.pop()
					session.post('Runtime.getProperties', {
						objectId: element.value.objectId,
						ownProperties: true // Return properties for this object, not its prototype chain.
					}, (err, params) => {
						if (err) {
							session.disconnect()
							return cb(err)
						}

						const status = params.internalProperties.find(({ name }) => name === '[[PromiseStatus]]')
						const isPending = !!status && status.value.value === 'pending'
						if (isPending) {
							pendingPromises.push(element)
						}

						loop()
					});
				}
				loop()
			});
		});
	});
}
