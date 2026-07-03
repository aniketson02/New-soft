import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const PALETTE = ['#D96C3D', '#4C8C5C', '#4A6FA5', '#9A5AA0', '#C2903A', '#4B8F8C'];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function Avatar({
  memberId,
  name,
  size = 28,
}: {
  memberId: string;
  name: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(memberId) },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.5 }]}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '700' },
});
