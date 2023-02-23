import ChooseFile from '@components/Shared/ChooseFile';
import { Button } from '@components/UI/Button';
import { ErrorMessage } from '@components/UI/ErrorMessage';
import { Image } from '@components/UI/Image';
import { Modal } from '@components/UI/Modal';
import { Spinner } from '@components/UI/Spinner';
import { PencilIcon } from '@heroicons/react/outline';
import getSignature from '@lib/getSignature';
import { getCroppedImg } from '@lib/image-cropper/cropUtils';
import type { Area, Size } from '@lib/image-cropper/types';
import imageProxy from '@lib/imageProxy';
import { Mixpanel } from '@lib/mixpanel';
import onError from '@lib/onError';
import splitSignature from '@lib/splitSignature';
import uploadToIPFS from '@lib/uploadToIPFS';
import { t, Trans } from '@lingui/macro';
import { LensHubProxy } from 'abis';
import { AVATAR, ERROR_MESSAGE, LENSHUB_PROXY, SIGN_WALLET } from 'data/constants';
import type { MediaSet, NftImage, Profile, UpdateProfileImageRequest } from 'lens';
import {
  useBroadcastMutation,
  useCreateSetProfileImageUriTypedDataMutation,
  useCreateSetProfileImageUriViaDispatcherMutation
} from 'lens';
import type { ChangeEvent, FC } from 'react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAppStore } from 'src/store/app';
import { SETTINGS } from 'src/tracking';
import getIPFSLink from 'utils/getIPFSLink';
import { useContractWrite, useSignTypedData } from 'wagmi';

import ImageCropper from './ImageCropper';

interface Props {
  profile: Profile & { picture: MediaSet & NftImage };
}

const Picture: FC<Props> = ({ profile }) => {
  const userSigNonce = useAppStore((state) => state.userSigNonce);
  const setUserSigNonce = useAppStore((state) => state.setUserSigNonce);
  const currentProfile = useAppStore((state) => state.currentProfile);
  const [avatar, setAvatar] = useState('');
  const [uploading, setUploading] = useState(false);
  const { isLoading: signLoading, signTypedDataAsync } = useSignTypedData({ onError });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [imageSrc, setImageSrc] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);

  const onCompleted = () => {
    toast.success(t`Avatar updated successfully!`);
    Mixpanel.track(SETTINGS.PROFILE.SET_PICTURE);
  };

  const {
    isLoading: writeLoading,
    error,
    write
  } = useContractWrite({
    address: LENSHUB_PROXY,
    abi: LensHubProxy,
    functionName: 'setProfileImageURIWithSig',
    mode: 'recklesslyUnprepared',
    onSuccess: onCompleted,
    onError
  });

  useEffect(() => {
    if (profile?.picture?.original?.url || profile?.picture?.uri) {
      setAvatar(profile?.picture?.original?.url ?? profile?.picture?.uri);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [broadcast, { loading: broadcastLoading }] = useBroadcastMutation({
    onCompleted
  });
  const [createSetProfileImageURITypedData, { loading: typedDataLoading }] =
    useCreateSetProfileImageUriTypedDataMutation({
      onCompleted: async ({ createSetProfileImageURITypedData }) => {
        const { id, typedData } = createSetProfileImageURITypedData;
        const { profileId, imageURI, deadline } = typedData.value;
        const signature = await signTypedDataAsync(getSignature(typedData));
        const { v, r, s } = splitSignature(signature);
        const sig = { v, r, s, deadline };
        const inputStruct = {
          profileId,
          imageURI,
          sig
        };
        setUserSigNonce(userSigNonce + 1);
        const { data } = await broadcast({ variables: { request: { id, signature } } });
        if (data?.broadcast.__typename === 'RelayError') {
          return write?.({ recklesslySetUnpreparedArgs: [inputStruct] });
        }
      },
      onError
    });

  const [createSetProfileImageURIViaDispatcher, { loading: dispatcherLoading }] =
    useCreateSetProfileImageUriViaDispatcherMutation({ onCompleted, onError });

  const createViaDispatcher = async (request: UpdateProfileImageRequest) => {
    const { data } = await createSetProfileImageURIViaDispatcher({
      variables: { request }
    });
    if (data?.createSetProfileImageURIViaDispatcher?.__typename === 'RelayError') {
      await createSetProfileImageURITypedData({
        variables: {
          options: { overrideSigNonce: userSigNonce },
          request
        }
      });
    }
  };

  const uploadImage = async (image: HTMLCanvasElement): Promise<string> => {
    const blob = await new Promise((resolve) => image.toBlob(resolve));
    let file = new File([blob as Blob], 'cropped_image.png', { type: (blob as Blob).type });
    let url = '';
    try {
      const attachment = await uploadToIPFS([file]);
      if (attachment[0]?.item) {
        url = attachment[0].item;
      }
    } finally {
      setAvatar(image.toDataURL('image/png'));
      setShowCropModal(false);
    }
    return url;
  };

  const uploadAndSave = async () => {
    if (!currentProfile) {
      return toast.error(SIGN_WALLET);
    }
    const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
    if (!croppedImage) {
      return toast.error(ERROR_MESSAGE);
    }
    setUploading(true);
    let avatar = await uploadImage(croppedImage);
    setUploading(false);
    if (!avatar) {
      return toast.error(t`Upload failed`);
    }

    try {
      const request: UpdateProfileImageRequest = {
        profileId: currentProfile?.id,
        url: avatar
      };

      if (currentProfile?.dispatcher?.canUseRelay) {
        return await createViaDispatcher(request);
      }

      return await createSetProfileImageURITypedData({
        variables: {
          options: { overrideSigNonce: userSigNonce },
          request
        }
      });
    } catch (error) {
      console.error(error);
    }
  };

  const isLoading =
    typedDataLoading || dispatcherLoading || signLoading || writeLoading || broadcastLoading || uploading;

  function readFile(file: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result as string), false);
      reader.readAsDataURL(file);
    });
  }

  const onFileChange = async (evt: ChangeEvent<HTMLInputElement>) => {
    if (evt.target.files && evt.target.files.length > 0) {
      const file = evt.target.files[0];
      setShowCropModal(true);
      let imageDataUrl = await readFile(file);
      setImageSrc(imageDataUrl);
    }
  };

  const avatarPreviewSize: Size = { width: 240, height: 240 };

  return (
    <>
      <Modal
        title={t`Crop image`}
        show={showCropModal}
        onClose={() => {
          setImageSrc('');
          setShowCropModal(false);
        }}
      >
        <div className="p-5">
          <ImageCropper
            imageSrc={imageSrc}
            setCroppedAreaPixels={setCroppedAreaPixels}
            size={avatarPreviewSize}
          />
          <Button
            type="submit"
            disabled={isLoading || !imageSrc}
            onClick={() => uploadAndSave()}
            icon={isLoading ? <Spinner size="xs" /> : <PencilIcon className="h-4 w-4" />}
          >
            <Trans>Save</Trans>
          </Button>
        </div>
      </Modal>
      <div className="space-y-1.5">
        {error && <ErrorMessage className="mb-3" title={t`Transaction failed!`} error={error} />}
        <div className="space-y-3">
          {avatar && (
            <div>
              <Image
                className="rounded-lg"
                height={avatarPreviewSize.height}
                width={avatarPreviewSize.width}
                onError={({ currentTarget }) => {
                  currentTarget.src = getIPFSLink(avatar);
                }}
                src={imageProxy(getIPFSLink(avatar), AVATAR)}
                alt={avatar}
              />
            </div>
          )}
          <div className="flex items-center space-x-3">
            <ChooseFile onChange={(evt: ChangeEvent<HTMLInputElement>) => onFileChange(evt)} />
          </div>
        </div>
      </div>
    </>
  );
};

export default Picture;
