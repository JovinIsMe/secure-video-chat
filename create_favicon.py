from PIL import Image, ImageDraw

def create_video_camera_favicon():
    # Create a 32x32 image with transparent background
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Define colors
    camera_color = (66, 153, 225)  # Blue color

    # Draw camera body
    draw.rectangle([8, 10, 24, 22], fill=camera_color)

    # Draw camera lens
    draw.ellipse([12, 13, 20, 19], fill='white')
    draw.ellipse([13, 14, 19, 18], fill=camera_color)

    # Draw camera top part
    draw.polygon([24, 10, 24, 16, 28, 14, 28, 12], fill=camera_color)

    # Save as ICO file
    img.save('static/favicon.ico', format='ICO', sizes=[(32, 32)])

if __name__ == '__main__':
    create_video_camera_favicon()
