const fs =require('fs');
const p = require('path');

function load(path) {require
    return fs.readFileSync(path,'utf8');
}

var modules = {};
var impls = {};

function inline(path) {
    var text  = load(path);
    const dir = p.dirname( path );

    return text.replace(/ require\("\.\/(.*?)"\)/g , (s,...a)=>{
        
        let name = a[0];
        let filename = p.resolve( dir, name +".js");
        
        name = name.replace(/[\\\/\-\.]/g,'');
        if( !modules[filename] ) {
            modules[filename] = `const require_${name} = inline_${name}()`;

          impls[filename] = `function inline_${name}(){
            var exports = {};
            ${ inline( filename )}
            return exports;
        };`;
        }
        return `inline_${name}()`;
    });
}


let sl = inline(`${__dirname}/../dist/lib/static-loader.js`);

let impl = "\n";
let mod = "\n";

for( const each in modules) {
    mod =  mod + '\n' + modules[each];
    impl = impls[each] + '\n' + impl;
}

//sl = sl.replace("// @modules", mod);
sl = sl.replace("// @impls", impl);

// remove crap
sl = sl.replace( /\/\/# sourceMappingURL.*/g,"");

fs.writeFileSync(`${__dirname}/../dist/lib/static-loader.js`,sl);
