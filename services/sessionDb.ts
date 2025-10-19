/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

const DB_NAME = 'utilpic-db';
const STORE_NAME = 'history-images';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(new Error('Could not open IndexedDB. Your browser might be in private mode or does not support it.'));
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }
    return dbPromise;
};

export const saveImageToHistoryDB = async (id: number, imageDataUrl: string): Promise<void> => {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ id, imageDataUrl });
    
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getImageFromHistoryDB = async (id: number): Promise<string | undefined> => {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result?.imageDataUrl);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
};

export const getAllHistoryImagesDB = async (historyLength: number): Promise<string[]> => {
    const promises: Promise<string | undefined>[] = [];
    for (let i = 0; i < historyLength; i++) {
        promises.push(getImageFromHistoryDB(i));
    }
    const results = await Promise.all(promises);
    return results.filter((item): item is string => !!item);
};

export const clearHistoryDB = async (): Promise<void> => {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const removeImagesFromHistoryDB = async (fromIndex: number): Promise<void> => {
    const db = await getDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const cursorRequest = store.openCursor(IDBKeyRange.lowerBound(fromIndex));
    
    return new Promise((resolve, reject) => {
        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            } else {
                // When cursor is null, we are done.
                // The transaction will auto-commit.
            }
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};