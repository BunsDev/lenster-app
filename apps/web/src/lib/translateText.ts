import { GOOGLE_API_KEY } from 'data/constants';
import { decode } from 'html-entities';

export interface TranslationResult {
  detectedSourceLanguage: string;
  translatedText: string;
}

const translateText = async (sourceText: string, targetLanguage: string): Promise<TranslationResult> => {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`;
  const request = {
    q: [sourceText],
    target: targetLanguage
  };
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(request));
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        const data = JSON.parse(this.responseText);
        const translation = data.data.translations[0];
        resolve({
          detectedSourceLanguage: translation.detectedSourceLanguage,
          translatedText: decode(translation.translatedText)
        });
      } else {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
  });
};

export default translateText;
