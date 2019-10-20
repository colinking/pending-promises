import {Session} from 'inspector';

export async function get() {
	// Open a session with the Node.js V8 Inspector. See:
	//  - https://nodejs.org/api/inspector.html#inspector_class_inspector_session
	//  - https://chromedevtools.github.io/devtools-protocol/v8/Runtime
	const session = new Session();
	session.connect();

	let promises = [];

	try {
		const promisePrototypeObjectID = await getPromisePrototypeObjectID(session);

		// At this point, we'll have an extra promise in it from the promise above.^^ we'll need to filter this one out.
		const promisesArrayObjectID = await getPromiseArrayObject(session, promisePrototypeObjectID);

		// We don't need the Promise.prototype object anymore; release it.
		await releaseObject(session, promisePrototypeObjectID);

		const elements = await getElements(session, promisesArrayObjectID);

		// We don't need the promises array anymore; release it.
		await releaseObject(session, promisesArrayObjectID);

		const promiseProperties = await Promise.all(elements.map(e => {
			return getProperties(session, e.value.objectId)
		}))

		// Filter out completed promises:
		promises = promiseProperties.filter(p => {
			const status = p.internalProperties.find(({ name }) => name === '[[PromiseStatus]]')
			return status && status.value.value === 'pending'
		})
	} finally {
		session.disconnect();
	}

	return promises;
}

/** Returns the object ID (string) of `Promise.prototype`. */
async function getPromisePrototypeObjectID(session) {
	const p = new Promise((resolve, reject) => {
		session.post('Runtime.evaluate', {
			expression: 'Promise.prototype'
		}, (err, params) => {
			if (err) {
				return reject(err);
			}

			resolve(params.result.objectId);
		});
	});

	return p
}

/** Returns a reference to an array with all promises in it. */
async function getPromiseArrayObject(session, promiseID) {
	const p = new Promise((resolve, reject) => {
		session.post('Runtime.queryObjects', {
			prototypeObjectId: promiseID
		}, (err, params) => {
			if (err) {
				return reject(err);
			}

			resolve(params.objects.objectId);
		});
	})

	return p
}

/** Releases an object via the Runtime API. */
async function releaseObject(session, objectID) {
	const p = new Promise((resolve, reject) => {
		session.post('Runtime.releaseObject', {
			objectId: objectID
		}, err => {
			if (err) {
				return reject(err);
			}

			resolve();
		});
	})

	return p
}

async function getElements(session, objectID) {
	const { result: properties } = await getProperties(session, objectID);

	// Filter out anything that isn't an element, i.e., length and __proto__.
	return properties.filter(p => !!p.enumerable)
}

async function getProperties(session, objectID) {
	const p = new Promise((resolve, reject) => {
		session.post('Runtime.getProperties', {
			objectId: objectID,
			ownProperties: true // Return properties for this object, not its prototype chain.
		}, (err, params) => {
			if (err) {
				return reject(err);
			}

			resolve(params);
		});
	})

	return p
}
