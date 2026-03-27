from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ChatRequestSerializer
from .services.graph_service import run_chatbot


class ChatbotView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = run_chatbot(
            user=request.user,
            message=serializer.validated_data["message"],
            history=serializer.validated_data.get("history", []),
            response_mode=serializer.validated_data.get("response_mode", "global"),
        )
        return Response(result)
