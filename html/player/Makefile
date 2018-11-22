
INPUT = login.js nubocache.js uxip.js uxipReader.js uxipWriter.js wm.js zlibReader.js NuboOutputStreamMgr.js nubocache.js opengl.js

default: out.js

compiler.jar:
	wget http://dl.google.com/closure-compiler/compiler-latest.tar.gz -O - | tar -xzf - compiler.jar

out.js: compiler.jar $(INPUT)
	java -jar compiler.jar -O SIMPLE --language_in ECMASCRIPT5 --js_output_file=$@ $(INPUT)

