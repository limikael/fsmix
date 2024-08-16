import FS from '@isomorphic-git/lightning-fs';
import {useIsoContext, useIsoMemo} from "isoq";

function Main() {
    useIsoMemo(async()=>{
        let fs=new FS("testfs");
        await fs.promises.writeFile("/hello.txt","hello world");
        //await fs.promises.mkdir("/test");
        await fs.promises.writeFile("/test/hello2.txt","hello world bla");
        console.log("written...");
    });

    return (
        "hello"
    );
}

export default function() {
    let iso=useIsoContext();
    if (iso.isSsr())
        return;

    return <Main/>;
}
