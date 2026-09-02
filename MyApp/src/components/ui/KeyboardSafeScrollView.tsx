import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MeasureFn = () => void;

type KeyboardScrollContextValue = {
  registerField: (measure: MeasureFn) => void;
  scrollField: (windowY: number, fieldHeight: number) => void;
};

const KeyboardScrollContext = createContext<KeyboardScrollContextValue | null>(null);

export function useKeyboardScroll() {
  return useContext(KeyboardScrollContext);
}

/** Use with raw TextInput (not TextField). */
export function useScrollFieldIntoView() {
  const ctx = useKeyboardScroll();
  const ref = useRef<import('react-native').View>(null);

  const onFocus = useCallback(() => {
    if (!ctx || !ref.current) return;
    const measure = () => {
      ref.current?.measureInWindow((_x, y, _w, h) => {
        ctx.scrollField(y, h);
      });
    };
    ctx.registerField(measure);
    measure();
  }, [ctx]);

  return { ref, onFocus };
}

type Props = ScrollViewProps & {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export const KeyboardSafeScrollView = forwardRef<ScrollView, Props>(function KeyboardSafeScrollView(
  { children, contentContainerStyle, style, ...props },
  ref,
) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const innerRef = useRef<ScrollView>(null);
  const scrollRef = (ref as RefObject<ScrollView>) ?? innerRef;
  const scrollY = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);
  const remeasureRef = useRef<MeasureFn | null>(null);

  const scrollField = useCallback(
    (windowY: number, fieldHeight: number) => {
      const kbHeight = keyboardHeightRef.current;
      if (kbHeight <= 0) return;

      const keyboardTop = windowHeight - kbHeight;
      const fieldBottom = windowY + fieldHeight;
      const visibleGap = 28;

      if (fieldBottom > keyboardTop - visibleGap) {
        const scrollBy = fieldBottom - keyboardTop + visibleGap;
        scrollRef.current?.scrollTo({
          y: scrollY.current + scrollBy,
          animated: true,
        });
      }
    },
    [scrollRef, windowHeight],
  );

  const registerField = useCallback((measure: MeasureFn) => {
    remeasureRef.current = measure;
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const kbHeight = event.endCoordinates.height;
      keyboardHeightRef.current = kbHeight;
      setKeyboardHeight(kbHeight);
      requestAnimationFrame(() => remeasureRef.current?.());
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      remeasureRef.current = null;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const contextValue: KeyboardScrollContextValue = {
    registerField,
    scrollField: (windowY, fieldHeight) => scrollField(windowY, fieldHeight),
  };

  const bottomPad =
    Platform.OS === 'android'
      ? insets.bottom + keyboardHeight + 40
      : insets.bottom + 40;

  return (
    <KeyboardScrollContext.Provider value={contextValue}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={[{ paddingBottom: bottomPad, flexGrow: 1 }, contentContainerStyle]}
          style={[{ flex: 1 }, style]}
          {...props}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </KeyboardScrollContext.Provider>
  );
});
