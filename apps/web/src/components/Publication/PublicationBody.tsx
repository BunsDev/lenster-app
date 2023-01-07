import Attachments from '@components/Shared/Attachments';
import IFramely from '@components/Shared/IFramely';
import Markup from '@components/Shared/Markup';
import { EyeIcon } from '@heroicons/react/outline';
import getURLs from '@lib/getURLs';
import type { TranslationResult } from '@lib/translateText';
import translateText, { detectLanguage } from '@lib/translateText';
import { Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import clsx from 'clsx';
import type { Publication } from 'lens';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { FC } from 'react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import DecryptedPublicationBody from './DecryptedPublicationBody';

interface Props {
  publication: Publication;
}

const PublicationBody: FC<Props> = ({ publication }) => {
  const { pathname } = useRouter();
  const showMore = publication?.metadata?.content?.length > 450 && pathname !== '/posts/[id]';
  const [translatedText, setTranslatedText] = useState<TranslationResult | null>(null);
  const [canTranslate, setCanTranslate] = useState(false);
  const { i18n } = useLingui();

  useEffect(() => {
    (async () => {
      const detectedLang = await detectLanguage(publication?.metadata?.content);
      if (detectedLang != i18n.locale) {
        setCanTranslate(true);
      }
    })();
  }, [i18n.locale, publication?.metadata?.content]);

  if (publication?.metadata?.encryptionParams) {
    return <DecryptedPublicationBody encryptedPublication={publication} />;
  }

  const translateContent = async (sourceText: string) => {
    try {
      const translationResult = await translateText(sourceText, i18n.locale);
      setTranslatedText(translationResult);
    } catch (error) {
      console.error(error);
      toast.error('Translation failed');
    }
  };

  return (
    <div className="break-words">
      <Markup className={clsx({ 'line-clamp-5': showMore }, 'markup linkify text-md break-words')}>
        {publication?.metadata?.content}
      </Markup>
      {showMore && (
        <div className="lt-text-gray-500 mt-4 flex items-center space-x-1 text-sm font-bold">
          <EyeIcon className="h-4 w-4" />
          <Link href={`/posts/${publication?.id}`}>
            <Trans>Show more</Trans>
          </Link>
        </div>
      )}
      {!translatedText ? (
        canTranslate && (
          <div className="mt-4 text-sm lt-text-gray-500 font-bold flex items-center space-x-1">
            <button
              type="button"
              onClick={(event) => {
                translateContent(publication?.metadata?.content);
                event.stopPropagation();
              }}
            >
              <Trans>🌐 Translate post</Trans>
            </button>
          </div>
        )
      ) : (
        <div>
          <div>Translated from: {translatedText.detectedSourceLanguage}</div>
          <div>{translatedText.translatedText}</div>
          <button
            type="button"
            onClick={(event) => {
              setTranslatedText(null);
              event.stopPropagation();
            }}
          >
            Hide
          </button>
        </div>
      )}

      {publication?.metadata?.media?.length > 0 ? (
        <Attachments attachments={publication?.metadata?.media} publication={publication} />
      ) : (
        publication?.metadata?.content &&
        getURLs(publication?.metadata?.content)?.length > 0 && (
          <IFramely url={getURLs(publication?.metadata?.content)[0]} />
        )
      )}
    </div>
  );
};

export default PublicationBody;
