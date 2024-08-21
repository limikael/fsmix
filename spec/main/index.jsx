import {createIndexFs} from '../../src/lib/lib.js';
import {useIsoContext, useIsoMemo} from "isoq";

function Main() {
    useIsoMemo(async()=>{
        let fs=createIndexFs();
        window.fs=fs;
        await fs.init();

        if (fs.existsSync("hello.txt"))
            await fs.promises.unlink("hello.txt");

        if (fs.existsSync("test/hello2.txt"))
            await fs.promises.unlink("test/hello2.txt");

        if (fs.existsSync("test"))
            await fs.promises.unlink("test");

        console.log("running");

        await fs.promises.writeFile("/hello.txt","hello world");
        await fs.promises.mkdir("/test");
        await fs.promises.writeFile("/test/hello2.txt","hello world bla");
        await new Promise(r=>setTimeout(r,100));
        let content=await fs.promises.readFile("/hello.txt","utf8");
        console.log("read back: "+content);
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
