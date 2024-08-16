export async function catchError(fn) {
	let error;
	try {
		await fn();
	}

	catch (e) {
		error=e;
	}

	return error;
}