import os, zipfile, sys

app = r'C:\Users\musad\Downloads\E-Qarza-App-Ready (1)\app'
zip_path = r'C:\Users\musad\Downloads\E-Qarza-Deploy.zip'

print(f'Creating zip from {app}')
print(f'To: {zip_path}')

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    count = 0
    for root, dirs, files in os.walk(app):
        for f in files:
            full = os.path.join(root, f)
            arc = os.path.relpath(full, app)
            zf.write(full, arc)
            count += 1
    print(f'Added {count} files')

print(f'Done: {os.path.getsize(zip_path) // (1024*1024)} MB')
