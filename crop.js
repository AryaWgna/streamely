const { Jimp } = require('jimp');
const fs = require('fs');

async function cropImages() {
  const files = ['docs/screenshot-1.png', 'docs/screenshot-2.png', 'docs/screenshot-3.png'];
  
  for (const file of files) {
    if (fs.existsSync(file)) {
      console.log(`Cropping ${file}...`);
      const image = await Jimp.read(file);
      
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      
      // Asumsi browser tab + url bar ~ 125px (Chrome Windows)
      // Asumsi taskbar bawah ~ 45px
      const topCrop = 125;
      const bottomCrop = 45;
      
      const newHeight = height - topCrop - bottomCrop;
      
      image.crop({ x: 0, y: topCrop, w: width, h: newHeight });
      await image.write(file); // Overwrite
      console.log(`Successfully cropped ${file}`);
    }
  }
}

cropImages().catch(console.error);
