import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/common';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

export default function HomeScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  const canSend = useMemo(() => text.trim().length > 0, [text]);

  const handleSend = () => {
    const value = text.trim();
    if (!value) {
      return;
    }
    setMessages((previous) => [...previous, value]);
    setText('');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 8}>
        <FlatList
          data={messages}
          keyExtractor={(_, index) => `${index}`}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={[styles.messageBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppText>{item}</AppText>
            </View>
          )}
        />

        <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.placeholder as string}
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendButton,
              {
                backgroundColor: canSend ? colors.primary : colors.border,
              },
            ]}>
            <SymbolView
              name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
              size={16}
              tintColor="#FFFFFF"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardRoot: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  messageBubble: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  composer: {
    margin: 12,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 52,
    paddingLeft: 12,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
