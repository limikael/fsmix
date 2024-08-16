import {indexedDB} from "fake-indexeddb";
import {requestPromise} from "../src/utils/idb-util.js";

let req=indexedDB.open("hello",1);
await requestPromise(req);
console.log("opened");
//req.onerror=()=>{console.log("error");};
//req.onsuccess=()=>{console.log("success");};