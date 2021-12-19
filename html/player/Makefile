
INPUT = login.js nubocache.js uxip.js uxipReader.js uxipWriter.js wm.js zlibReader.js NuboOutputStreamMgr.js nubocache.js opengl.js ops.js

default: out.js

compiler.jar:
	wget https://repo1.maven.org/maven2/com/google/javascript/closure-compiler/v20211201/closure-compiler-v20211201.jar -O compiler.jar
#	wget http://dl.google.com/closure-compiler/compiler-latest.tar.gz -O - | tar -xzf - compiler.jar

out.js: compiler.jar $(INPUT)
	java -jar compiler.jar -O SIMPLE --language_in ECMASCRIPT6 --js_output_file=$@ $(INPUT)

