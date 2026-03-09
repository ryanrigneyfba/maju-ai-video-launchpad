import re

with open("/tmp/maju-fix-temp/server/index.js", "r") as f:
    content = f.read()

# Fix 1: Change SOP_SEGMENTS durations to all maxDuration: 3
content = re.sub(r"maxDuration:\s*\d+", "maxDuration: 3", content)
print("sop_fix: applied")

with open("/tmp/maju-fix-temp/server/index.js", "w") as f:
    f.write(content)
print("server fix 1 done")
