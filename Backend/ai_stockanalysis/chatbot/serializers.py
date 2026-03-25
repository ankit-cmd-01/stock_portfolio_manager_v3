from rest_framework import serializers


class ChatMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(max_length=4000)


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=4000)
    history = ChatMessageSerializer(many=True, required=False, default=list)
