/**
 * Reduz a imagem enviada para as dimensões recomendadas antes de virar data URI.
 *
 * O design é salvo como um único documento no Firestore, que tem teto de 1MB
 * para o documento inteiro — logo, selo e prêmio somados. Um PNG de 2MB vira
 * ~2,7MB em base64 e estouraria esse limite, fazendo a publicação falhar.
 * Redimensionando aqui, cada imagem fica na casa dos KB.
 */
export function resizeImageDataUrl(
  file: File,
  maxSize: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    // SVG é vetorial: redimensionar em canvas rasterizaria e perderia qualidade.
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // PNG preserva a transparência, que é o formato recomendado para os selos.
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
