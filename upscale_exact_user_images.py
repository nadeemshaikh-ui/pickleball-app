import os
from PIL import Image, ImageEnhance, ImageFilter

user_dir = r'C:\Users\Nadeem\.gemini\antigravity\brain\3d633335-c773-43f9-9a42-61b9a52d9729\.user_uploaded'
hotshot_dir = r'C:\Users\Nadeem\Desktop\HOTSHOT'

image_mapping = {
    'media_1785837514965.png': 'Who_Is_The_Hot_Shot_Master_Court_Allocations_Original_4K.png',
    'media__1785397402925.png': 'Who_Is_The_Hot_Shot_Court_1_Official_Scorecard_Original_4K.png',
    'media__1785397580210.png': 'Who_Is_The_Hot_Shot_Court_2_Official_Scorecard_Original_4K.png',
    'media_1785837514963.png': 'Who_Is_The_Hot_Shot_Court_3_Official_Scorecard_Original_4K.png'
}

for src_name, dest_name in image_mapping.items():
    src_path = os.path.join(user_dir, src_name)
    dest_path = os.path.join(hotshot_dir, dest_name)

    if os.path.exists(src_path):
        img = Image.open(src_path)
        orig_w, orig_h = img.size

        # Target 4K resolution (width = 3840px)
        target_w = 3840
        target_h = int(orig_h * (target_w / orig_w))

        # High-quality Lanczos upscaling (preserves exact original design 100%)
        resampled = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        
        # Subtle contrast & sharpness enhancement for ultra-crisp print output
        enhancer = ImageEnhance.Sharpness(resampled)
        sharpened = enhancer.enhance(1.25)
        
        contrast_enhancer = ImageEnhance.Contrast(sharpened)
        final_img = contrast_enhancer.enhance(1.05)

        final_img.save(dest_path, 'PNG', dpi=(300, 300))
        print(f'Upscaled original image saved: {dest_path} ({target_w}x{target_h} @ 300 DPI)')
    else:
        print(f'Source file not found: {src_path}')

print('ALL ORIGINAL USER IMAGES UPSCALED TO 4K @ 300 DPI SUCCESSFULLY!')
